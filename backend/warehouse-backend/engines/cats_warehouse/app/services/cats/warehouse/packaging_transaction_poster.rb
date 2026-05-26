# frozen_string_literal: true

module Cats
  module Warehouse
    class PackagingTransactionPoster
      def initialize(actor:, transaction_type:, warehouse:, commodity:, quantity:, unit_id:,
                     reference_order:, packaging_unit_id: nil, packaging_size: nil,
                     execution_id: nil, apply_inventory: false)
        @actor = actor
        @transaction_type = transaction_type
        @warehouse = warehouse
        @commodity = commodity
        @quantity = quantity.to_f
        @unit_id = unit_id
        @reference_order = reference_order
        @packaging_unit_id = packaging_unit_id
        @packaging_size = packaging_size
        @execution_id = execution_id
        @apply_inventory = apply_inventory
      end

      def call
        base_unit_id = @commodity.unit_of_measure_id
        base_qty = UomConversionResolver.convert!(@quantity, from_unit_id: @unit_id, to_unit_id: base_unit_id, commodity_id: @commodity.id)

        package_count = nil
        if @packaging_size.to_f.positive?
          package_count = (base_qty / @packaging_size.to_f).ceil
        end

        PackagingTransaction.transaction do
          pt = PackagingTransaction.create!(
            transaction_type: @transaction_type,
            warehouse: @warehouse,
            commodity: @commodity,
            quantity: @quantity,
            base_quantity: base_qty,
            unit_id: @unit_id,
            packaging_unit_id: @packaging_unit_id,
            packaging_size: @packaging_size,
            package_count: package_count,
            occurred_at: Time.current,
            reference_order_type: @reference_order.class.name,
            reference_order_id: @reference_order.id,
            dispatch_order_authorization_execution_id: @execution_id,
            created_by: @actor,
            status: PackagingTransaction::POSTED
          )

          apply_receipt_inventory!(base_qty) if @apply_inventory && @transaction_type == PackagingTransaction::RECEIVE

          NotificationFanout.deliver("packaging_transaction.posted", packaging_transaction_id: pt.id)
          pt
        end
      end

      private

      def apply_receipt_inventory!(base_qty)
        return unless ENV["PACKAGING_AFFECTS_INVENTORY"] == "true"

        # Destination exchange receive — extend with InventoryLedger.apply_receipt! when store/stack known
        Rails.logger.info("[PackagingTransactionPoster] inventory receipt skipped (no stack context) qty=#{base_qty}")
      end
    end
  end
end
