# frozen_string_literal: true

module Cats
  module Warehouse
    # Shared debit/credit preparation and UOM conversion for stack transfers.
    module StackMovementHelper
      module_function

      def prepare_destination_to_receive_goods!(source_stack:, destination_stack:)
        return unless source_stack.commodity_id.present?

        d = destination_stack
        return if d.quantity.to_f.positive?

        d.commodity_id = source_stack.commodity_id
        d.unit_id = source_stack.unit_id if d.unit_id.blank? && source_stack.unit_id.present?
        if d.respond_to?(:base_unit_id=) && source_stack.base_unit_id.present?
          d.base_unit_id = source_stack.base_unit_id
        end
      end

      def destination_has_different_commodity_with_stock?(source_stack:, destination_stack:)
        return false if destination_stack.quantity.to_f <= 0
        return false unless destination_stack.commodity_id.present?
        return false unless source_stack.commodity_id.present?

        destination_stack.commodity_id != source_stack.commodity_id
      end

      def same_commodity?(source_stack:, destination_stack:)
        source_stack.commodity_id.present? &&
          source_stack.commodity_id == destination_stack.commodity_id
      end

      def ensure_destination_unit!(source_stack:, destination_stack:)
        return if destination_stack.unit_id.present?

        destination_stack.unit_id = source_stack.unit_id
      end

      def compute_destination_credit_quantity(source_stack:, destination_stack:, quantity_in_source_unit:)
        dest_unit_id = destination_stack.unit_id
        raise ArgumentError, "Destination stack has no unit of measure" if dest_unit_id.blank?

        if source_stack.unit_id.to_i == dest_unit_id.to_i
          quantity_in_source_unit
        else
          UomConversionResolver.convert!(
            quantity_in_source_unit,
            from_unit_id: source_stack.unit_id,
            to_unit_id: dest_unit_id,
            commodity_id: source_stack.commodity_id
          )
        end
      end

      def update_stock_balance!(stack)
        balance = StockBalance.find_or_initialize_by(
          stack: stack,
          commodity: stack.commodity,
          store: stack.store,
          warehouse: stack.store.warehouse,
          unit: stack.unit
        )

        balance.quantity = stack.quantity
        balance.save!
      end

      def resolve_destination_stack_for_transfer_request(transfer_request, source_stack:)
        if transfer_request.destination_stack.present?
          return transfer_request.destination_stack
        end

        store = transfer_request.destination_store
        commodity = transfer_request.commodity

        empty_bay = Stack.where(store: store).where("quantity <= 0").order(:id).first
        return persist_destination_on_request(transfer_request, empty_bay) if empty_bay

        existing = Stack.where(store: store, commodity_id: commodity.id).order(:id).first
        return persist_destination_on_request(transfer_request, existing) if existing

        created = Stack.create!(
          store: store,
          commodity: commodity,
          unit: source_stack.unit,
          quantity: 0,
          length: source_stack.length,
          width: source_stack.width,
          height: source_stack.height,
          code: "#{store.code}-#{commodity.batch_no}-#{Time.current.to_i}"
        )
        persist_destination_on_request(transfer_request, created)
      end

      def persist_destination_on_request(transfer_request, stack)
        transfer_request.update!(destination_stack: stack) if transfer_request.destination_stack_id != stack.id
        stack
      end
    end
  end
end
