module Cats
  module Warehouse
    class InventoryLedger
      def self.apply_receipt!(warehouse:, item:, transaction_date:, reference:)
        new(
          warehouse: warehouse,
          item: item,
          transaction_date: transaction_date,
          reference: reference,
          quantity_delta: item.quantity.to_f
        ).call
      end

      def self.apply_issue!(warehouse:, item:, transaction_date:, reference:)
        new(
          warehouse: warehouse,
          item: item,
          transaction_date: transaction_date,
          reference: reference,
          quantity_delta: -item.quantity.to_f
        ).call
      end

      def self.apply_adjustment!(warehouse:, item:, quantity_delta:, transaction_date:, reference:)
        new(
          warehouse: warehouse,
          item: item,
          transaction_date: transaction_date,
          reference: reference,
          quantity_delta: quantity_delta.to_f
        ).call
      end

      def initialize(warehouse:, item:, transaction_date:, reference:, quantity_delta:)
        @warehouse = warehouse
        @item = item
        @transaction_date = transaction_date
        @reference = reference
        @quantity_delta = quantity_delta
        @base_unit_id = item.commodity.unit_of_measure_id
        @base_quantity_delta = calculate_base_delta
      end

      def call
        balance = locked_balance
        balance.quantity = balance.quantity.to_f + quantity_delta
        balance.base_quantity = balance.base_quantity.to_f + base_quantity_delta
        balance.base_unit_id ||= @base_unit_id
        balance.available_quantity = balance.quantity.to_f - balance.reserved_quantity.to_f if balance.respond_to?(:available_quantity)

        ensure_non_negative!(balance.base_quantity, "stock balance")
        balance.save!

        return balance unless item.stack_id.present?

        stack = Stack.lock.find(item.stack_id)

        # ── Space check (receipts only) ──────────────────────────────────────
        # Only enforce when goods are being added (positive delta).  Issues and
        # adjustments that reduce quantity can never overflow the store.
        ensure_warehouse_capacity_established! if quantity_delta.positive?
        check_incoming_volume!(stack, base_quantity_delta) if quantity_delta.positive?
        # ────────────────────────────────────────────────────────────────────

        stack.quantity = stack.quantity.to_f + quantity_delta
        stack.base_quantity = stack.base_quantity.to_f + base_quantity_delta
        stack.base_unit_id ||= @base_unit_id
        stack.stack_status = stack.quantity.to_f.positive? ? "active" : "empty"
        # Keep occupied_volume in sync: volume is claimed when the stack holds goods,
        # released when it is emptied.
        stack.occupied_volume = stack.quantity.to_f.positive? ? stack.volume : 0.0
        if quantity_delta.positive? && stack.commodity_id.blank?
          stack.commodity_id = item.commodity_id
          stack.unit_id = item.unit_id
        end

        # When a stack is emptied (quantity reaches 0), clear its commodity affiliation
        # so a different commodity can be placed in it next time.  Do this before save!
        # so the full ActiveRecord lifecycle (callbacks, validations) runs once over the
        # complete final state rather than issuing a second raw SQL UPDATE.
        if stack.quantity.to_f <= 0.0001
          stack.commodity_id   = nil
          stack.unit_id        = nil
          stack.base_unit_id   = nil
          stack.stack_status   = "empty"
          stack.occupied_volume = 0.0
        end

        ensure_non_negative!(stack.base_quantity, "stack quantity")
        stack.save!

        # Recalculate the store's available_space from live stack data so it
        # never becomes stale after receipts, issues, or adjustments.
        StoreOccupancyUpdater.call(store_id: stack.store_id)

        # Use the unit the user actually entered (e.g. Kuntal) when available.
        # Falls back to the canonical line unit (e.g. MT) for legacy records.
        tx_entered_unit_id = (item.respond_to?(:entered_unit_id) && item.entered_unit_id.present?) ? item.entered_unit_id : item.unit_id
        tx_entered_quantity = (item.respond_to?(:entered_quantity) && item.entered_quantity.present?) ? item.entered_quantity.abs : quantity_delta.abs

        StackTransaction.create!(
          source_id: quantity_delta.negative? ? item.stack_id : nil,
          destination_id: quantity_delta.positive? ? item.stack_id : nil,
          transaction_date: transaction_date,
          quantity: quantity_delta.abs,
          unit_id: item.unit_id,
          inventory_lot_id: item.respond_to?(:inventory_lot_id) ? item.inventory_lot_id : nil,
          entered_unit_id: tx_entered_unit_id,
          entered_quantity: tx_entered_quantity,
          base_unit_id: @base_unit_id,
          base_quantity: base_quantity_delta.abs,
          status: "Confirmed",
          reference_type: reference.class.name,
          reference_id: reference.id
        )

        balance
      end

      private

      attr_reader :warehouse, :item, :transaction_date, :reference, :quantity_delta, :base_quantity_delta

      def calculate_base_delta
        return quantity_delta if item.unit_id == @base_unit_id

        UomConversionResolver.convert(
          quantity_delta,
          from_unit_id: item.unit_id,
          to_unit_id: @base_unit_id,
          commodity_id: item.commodity_id
        )
      end

      def locked_balance
        attrs = {
          warehouse_id: warehouse.id,
          store_id: item.store_id,
          stack_id: item.stack_id,
          commodity_id: item.commodity_id,
          unit_id: item.unit_id,
          inventory_lot_id: item.respond_to?(:inventory_lot_id) ? item.inventory_lot_id : nil
        }

        StockBalance.lock.find_by(attrs) || StockBalance.create!(attrs.merge(quantity: 0, base_quantity: 0, base_unit_id: @base_unit_id, reserved_quantity: 0, available_quantity: 0))
      rescue ActiveRecord::RecordNotUnique
        retry
      end

      def ensure_non_negative!(value, label)
        return unless value < -0.0001 # Small epsilon for float issues

        item.errors.add(:base, "#{label} cannot be negative")
        raise ActiveRecord::RecordInvalid, item
      end

      # Calculates the physical volume the incoming goods will occupy and
      # verifies it fits in both the target stack and the target store.
      #
      # Two independent checks:
      #
      #   1. Stack capacity — the goods must fit within the stack's own volume
      #      (l × w × h).  A stack is a fixed physical space; you cannot put
      #      more into it than its dimensions allow.
      #
      #   2. Store available_space — the store's remaining free volume must be
      #      >= the incoming volume.  This catches the case where the stack
      #      itself has room but the store is already full of other stacks.
      #
      # Uses commodity volume_per_metric_ton when set; otherwise planning default
      # (CapacityCalculator::REFERENCE_M3_PER_MT) via VolumeCalculator.
      #
      # @param stack [Stack]  the locked stack row (already fetched)
      # @param incoming_base_qty [Numeric]  quantity in base unit (MT)
      def ensure_warehouse_capacity_established!
        return if warehouse.capacity_established?

        raise Cats::Warehouse::InsufficientSpaceError,
              "Warehouse capacity must be established before accepting commodities"
      end

      def check_incoming_volume!(stack, incoming_base_qty)
        incoming_m3 = VolumeCalculator.call(
          commodity: item.commodity,
          base_quantity: incoming_base_qty
        )

        incoming_mt = incoming_base_qty.to_f

        # Compute actual remaining volume from goods already on the stack,
        # rather than relying on occupied_volume (which is 0 or full volume).
        current_goods_m3 = if stack.base_quantity.to_f > 0
          VolumeCalculator.call(
            commodity: stack.commodity || item.commodity,
            base_quantity: stack.base_quantity.to_f
          ) || 0.0
        else
          0.0
        end

        stack_remaining = [stack.volume.to_f - current_goods_m3, 0.0].max
        if incoming_m3 > stack_remaining + 1e-6
          raise Cats::Warehouse::InsufficientSpaceError,
                "Insufficient stack capacity: incoming #{incoming_m3.round(4)} m³ " \
                "exceeds remaining stack space #{stack_remaining.round(4)} m³ " \
                "(stack #{stack.code.presence || "##{stack.id}"})"
        end

        if stack.max_capacity_mt.present?
          stack_used_mt = stack.base_quantity.to_f
          if stack_used_mt + incoming_mt > stack.max_capacity_mt.to_f + 1e-6
            raise Cats::Warehouse::InsufficientSpaceError,
                  "Insufficient stack capacity: incoming #{incoming_mt.round(4)} MT " \
                  "exceeds remaining stack capacity " \
                  "#{(stack.max_capacity_mt.to_f - stack_used_mt).round(4)} MT " \
                  "(stack #{stack.code.presence || "##{stack.id}"})"
          end
        end

        store = Store.lock.find_by(id: stack.store_id)
        return unless store

        store_remaining_vol = if store.has_attribute?(:available_volume_m3)
                                store.available_volume_m3.to_f
                              else
                                store.available_space.to_f
                              end

        if incoming_m3 > store_remaining_vol + 1e-6
          raise Cats::Warehouse::InsufficientSpaceError,
                "Insufficient store capacity: incoming #{incoming_m3.round(4)} m³ " \
                "exceeds store available volume #{store_remaining_vol.round(4)} m³ " \
                "(store #{store.name})"
        end

        wh_cap = warehouse.warehouse_capacity
        return unless wh_cap&.capacity_established?

        wh_usage = CapacityUsage.for_warehouse(warehouse)
        if wh_usage.used_mt + incoming_mt > wh_usage.capacity_mt + 1e-6
          raise Cats::Warehouse::InsufficientSpaceError,
                "Insufficient warehouse capacity: incoming #{incoming_mt.round(4)} MT " \
                "exceeds remaining warehouse capacity #{wh_usage.remaining_mt.round(4)} MT"
        end
      end
    end
  end
end
