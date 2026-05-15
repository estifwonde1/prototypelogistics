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

        StackTransaction.create!(
          source_id: quantity_delta.negative? ? item.stack_id : nil,
          destination_id: quantity_delta.positive? ? item.stack_id : nil,
          transaction_date: transaction_date,
          quantity: quantity_delta.abs,
          unit_id: item.unit_id,
          inventory_lot_id: item.respond_to?(:inventory_lot_id) ? item.inventory_lot_id : nil,
          entered_unit_id: item.unit_id,
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
      # If the commodity has no volume_per_metric_ton density factor the check
      # is skipped with a warning log.  This is intentional: blocking receipts
      # for commodities without density data would be worse than allowing them
      # through.  Operators should populate volume_per_metric_ton for all
      # commodities to get reliable enforcement.
      #
      # @param stack [Stack]  the locked stack row (already fetched)
      # @param incoming_base_qty [Numeric]  quantity in base unit (MT)
      def check_incoming_volume!(stack, incoming_base_qty)
        incoming_m3 = VolumeCalculator.call(
          commodity:    item.commodity,
          base_quantity: incoming_base_qty
        )

        if incoming_m3.nil?
          Rails.logger.warn(
            "[InventoryLedger] Skipping volume check for commodity #{item.commodity_id}: " \
            "volume_per_metric_ton is not set."
          )
          return
        end

        # ── 1. Stack capacity check ──────────────────────────────────────────
        # stack.volume is the physical container size (l × w × h).
        # stack.occupied_volume is what is already in it (before this receipt).
        stack_remaining = stack.volume.to_f - stack.occupied_volume.to_f
        if incoming_m3 > stack_remaining + 1e-6
          raise Cats::Warehouse::InsufficientSpaceError,
                "Insufficient stack capacity: incoming #{incoming_m3.round(4)} m³ " \
                "exceeds remaining stack space #{stack_remaining.round(4)} m³ " \
                "(stack #{stack.code.presence || "##{stack.id}"})"
        end

        # ── 2. Store available_space check ───────────────────────────────────
        # Use the locked store row so concurrent receipts don't race past the
        # check.  StoreOccupancyUpdater will refresh available_space after the
        # stack save, but we need the pre-commit value here.
        store = Store.lock.find_by(id: stack.store_id)
        return unless store # defensive — store should always exist

        if incoming_m3 > store.available_space.to_f + 1e-6
          raise Cats::Warehouse::InsufficientSpaceError,
                "Insufficient store capacity: incoming #{incoming_m3.round(4)} m³ " \
                "exceeds store available space #{store.available_space.to_f.round(4)} m³ " \
                "(store #{store.name})"
        end
      end
    end
  end
end
