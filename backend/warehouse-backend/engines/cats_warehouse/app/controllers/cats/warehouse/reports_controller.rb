module Cats
  module Warehouse
    class ReportsController < BaseController
      include FilterValidation

      def bin_card
        authorize StackTransaction, :index?, policy_class: StackTransactionPolicy

        scope = policy_scope(StackTransaction)
        bin_card_store_id = nil

        begin
          if params[:store_id].present?
            bin_card_store_id = validate_id_param(:store_id)
            validate_store_access!(bin_card_store_id)
            store_stack_ids = Stack.where(store_id: bin_card_store_id).pluck(:id)
            scope = scope.where(source_id: store_stack_ids).or(scope.where(destination_id: store_stack_ids))
          end

          if params[:stack_id].present?
            stack_id = validate_id_param(:stack_id)
            scope = scope.where(source_id: stack_id).or(scope.where(destination_id: stack_id))
          end

          date_range = validate_date_range
          scope = scope.where(transaction_date: date_range) if date_range

          base_for_lot = scope

          include_null = ActiveModel::Type::Boolean.new.cast(params[:include_null_inventory_lot])
          omit_lot_filter = ActiveModel::Type::Boolean.new.cast(params[:omit_lot_filter])
          stack_ids = normalize_bin_card_stack_ids

          if omit_lot_filter
            unless include_null && stack_ids.any?
              raise ArgumentError, "omit_lot_filter requires include_null_inventory_lot and stack_ids"
            end
          end

          lot_ids = resolve_bin_card_lot_ids(omit_lot_filter: omit_lot_filter)

          if include_null
            raise ArgumentError, "store_id is required when include_null_inventory_lot is true" if bin_card_store_id.blank?
            raise ArgumentError, "stack_ids is required when include_null_inventory_lot is true" if stack_ids.empty?

            validate_bin_card_stack_ids_in_store!(stack_ids, bin_card_store_id)
            if params[:commodity_id].present?
              commodity_for_stacks = validate_id_param(:commodity_id)
              validate_bin_card_stack_ids_commodity!(stack_ids, commodity_for_stacks, bin_card_store_id)
            end
          end

          null_part =
            if include_null && stack_ids.any?
              t = StackTransaction.arel_table
              base_for_lot.where(inventory_lot_id: nil).where(
                t[:source_id].in(stack_ids).or(t[:destination_id].in(stack_ids))
              )
            end

          lot_part =
            if lot_ids.nil?
              nil
            elsif lot_ids.empty?
              :empty
            else
              base_for_lot.where(inventory_lot_id: lot_ids)
            end

          scope =
            if null_part
              case lot_part
              when nil
                null_part
              when :empty
                null_part
              else
                lot_part.or(null_part)
              end
            else
              case lot_part
              when nil
                base_for_lot
              when :empty
                StackTransaction.none
              else
                lot_part
              end
            end
        rescue ArgumentError => e
          return render_error(e.message, status: :bad_request)
        rescue Pundit::NotAuthorizedError => e
          return render_error(e.message, status: :forbidden)
        end

        render_resource(scope.order(transaction_date: :desc, id: :desc), each_serializer: StackTransactionSerializer)
      end

      def stock_card
        authorize StackTransaction, :index?, policy_class: StackTransactionPolicy

        scope = policy_scope(StackTransaction)
                  .includes(:unit, :entered_unit, :base_unit, :inventory_lot, :source, :destination, :reference)

        begin
          scope = apply_stock_card_facility_filters(scope)
          date_range = validate_date_range
          scope = scope.where(transaction_date: date_range) if date_range

          commodity_id = params[:commodity_id].present? ? validate_id_param(:commodity_id) : nil
          inventory_lot_id = params[:inventory_lot_id].present? ? validate_id_param(:inventory_lot_id) : nil
          batch_no = params[:batch_no].to_s.strip.presence

          transactions = scope.order(transaction_date: :asc, id: :asc).to_a

          if inventory_lot_id.present?
            lot = InventoryLot.find_by(id: inventory_lot_id)
            raise ArgumentError, "inventory_lot not found" unless lot
            raise ArgumentError, "inventory_lot does not match commodity_id" if commodity_id.present? && lot.commodity_id != commodity_id

            transactions = transactions.select { |tx| tx.inventory_lot_id == inventory_lot_id }
          end

          if commodity_id.present?
            transactions = transactions.select { |tx| stock_card_transaction_commodity_id(tx) == commodity_id }
          end

          if batch_no.present?
            transactions = transactions.select do |tx|
              tx_batch = tx.inventory_lot&.batch_no.presence || stock_card_transaction_commodity(tx)&.batch_no
              tx_batch.to_s.strip.casecmp?(batch_no)
            end
          end
        rescue ArgumentError => e
          return render_error(e.message, status: :bad_request)
        rescue Pundit::NotAuthorizedError => e
          return render_error(e.message, status: :forbidden)
        end

        render_resource(transactions.reverse, each_serializer: StackTransactionSerializer)
      end

      private

      def apply_stock_card_facility_filters(scope)
        if params[:store_id].present?
          store_id = validate_id_param(:store_id)
          validate_store_access!(store_id)
          stack_ids = Stack.where(store_id: store_id).select(:id)
          return scope.where(source_id: stack_ids).or(scope.where(destination_id: stack_ids))
        end

        if params[:warehouse_id].present?
          warehouse_id = validate_id_param(:warehouse_id)
          unless policy_scope(Warehouse).exists?(id: warehouse_id)
            raise Pundit::NotAuthorizedError, "Access denied to warehouse #{warehouse_id}"
          end

          stack_ids = Stack.joins(:store).where(cats_warehouse_stores: { warehouse_id: warehouse_id }).select(:id)
          return scope.where(source_id: stack_ids).or(scope.where(destination_id: stack_ids))
        end

        scope
      end

      def stock_card_transaction_commodity_id(transaction)
        stock_card_reference_item(transaction)&.commodity_id.presence ||
          transaction.inventory_lot&.commodity_id.presence ||
          transaction.destination&.commodity_id.presence ||
          transaction.source&.commodity_id
      end

      def stock_card_transaction_commodity(transaction)
        item = stock_card_reference_item(transaction)
        if item&.respond_to?(:commodity) && item.commodity
          item.commodity
        elsif item&.respond_to?(:commodity_id) && item.commodity_id.present?
          Cats::Core::Commodity.find_by(id: item.commodity_id)
        elsif transaction.inventory_lot&.commodity
          transaction.inventory_lot.commodity
        elsif (cid = stock_card_transaction_commodity_id(transaction))
          Cats::Core::Commodity.find_by(id: cid)
        end
      end

      def stock_card_reference_item(transaction)
        reference = transaction.reference

        case reference
        when Grn
          items = reference.grn_items
          items.find_by(stack_id: transaction.destination_id, unit_id: transaction.unit_id) ||
            items.find_by(stack_id: transaction.destination_id) ||
            items.find_by(stack_id: transaction.source_id, unit_id: transaction.unit_id) ||
            items.find_by(stack_id: transaction.source_id) ||
            items.find_by(unit_id: transaction.unit_id) ||
            items.first
        when Gin
          items = reference.gin_items
          items.find_by(stack_id: transaction.source_id, unit_id: transaction.unit_id) ||
            items.find_by(stack_id: transaction.source_id) ||
            items.find_by(unit_id: transaction.unit_id) ||
            items.first
        when Inspection
          reference.inspection_items.find_by(
            commodity_id: transaction.destination&.commodity_id || transaction.source&.commodity_id
          )
        end
      end

      # Returns nil (no lot filter), [] (no matching lots / forced empty), or [id, ...]
      def resolve_bin_card_lot_ids(omit_lot_filter: false)
        if omit_lot_filter
          raise ArgumentError, "commodity_id is required with omit_lot_filter" unless params[:commodity_id].present?

          validate_id_param(:commodity_id)
          return []
        end

        if params[:inventory_lot_id].present?
          lot_id = validate_id_param(:inventory_lot_id)
          lot = InventoryLot.find_by(id: lot_id)
          raise ArgumentError, "inventory_lot not found" unless lot

          if params[:commodity_id].present?
            commodity_id = validate_id_param(:commodity_id)
            raise ArgumentError, "inventory_lot does not match commodity_id" if lot.commodity_id != commodity_id
          end

          return [lot.id]
        end

        if params[:commodity_id].present?
          commodity_id = validate_id_param(:commodity_id)
          lots = InventoryLot.where(commodity_id: commodity_id)
          if params[:batch_no].present?
            batch_no = params[:batch_no].to_s.strip
            raise ArgumentError, "Invalid batch_no" if batch_no.blank?

            lots = lots.where(batch_no: batch_no)
          end
          return lots.pluck(:id)
        end

        if params[:batch_no].present?
          batch_no = params[:batch_no].to_s.strip
          raise ArgumentError, "Invalid batch_no" if batch_no.blank?

          return InventoryLot.where(batch_no: batch_no).pluck(:id)
        end

        nil
      end

      def normalize_bin_card_stack_ids
        raw = params[:stack_ids]
        return [] if raw.blank?

        Array(raw).flat_map { |x| x.to_s.split(/[\s,]+/) }.filter_map do |s|
          s = s.to_s.strip
          next if s.blank?

          id = Integer(s)
          id if id.positive?
        end.uniq
      rescue ArgumentError
        raise ArgumentError, "Invalid stack_ids"
      end

      def validate_bin_card_stack_ids_in_store!(stack_ids, store_id)
        valid_count = Stack.where(store_id: store_id, id: stack_ids).count
        raise ArgumentError, "stack_ids must belong to the given store" unless valid_count == stack_ids.size
      end

      def validate_bin_card_stack_ids_commodity!(stack_ids, commodity_id, store_id)
        valid = Stack.where(id: stack_ids, store_id: store_id, commodity_id: commodity_id).count
        raise ArgumentError, "stack_ids must reference stacks holding the requested commodity" unless valid == stack_ids.size
      end
    end
  end
end
