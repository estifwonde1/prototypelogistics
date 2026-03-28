module Cats
  module Warehouse
    class InspectionConfirmer
      def initialize(inspection:)
        @inspection = inspection
      end

      def call
        @inspection.ensure_confirmable!

        Inspection.transaction do
          @inspection.update!(status: "Confirmed")

          apply_grn_updates if @inspection.source.is_a?(Cats::Warehouse::Grn)

          enqueue_notification("inspection.confirmed", inspection_id: @inspection.id)

          @inspection
        end
      end

      private

      def apply_grn_updates
        grn = @inspection.source

        @inspection.inspection_items.find_each do |item|
          grn_item = grn.grn_items.find_by(commodity_id: item.commodity_id)
          next unless grn_item

          if item.quality_status.present?
            grn_item.update!(quality_status: item.quality_status)
          end

          loss_qty = item.quantity_damaged.to_f + item.quantity_lost.to_f
          next unless loss_qty.positive?

          ensure_available_stock!(grn_item, loss_qty)
          apply_stock_loss(grn_item, loss_qty)
        end
      end

      def ensure_available_stock!(grn_item, loss_qty)
        available_quantity = Cats::Warehouse::StockBalance.find_by(
          warehouse_id: @inspection.warehouse_id,
          store_id: grn_item.store_id,
          stack_id: grn_item.stack_id,
          commodity_id: grn_item.commodity_id,
          unit_id: grn_item.unit_id
        )&.quantity.to_f

        return if available_quantity >= loss_qty

        @inspection.errors.add(
          :base,
          "Inspection adjustment exceeds available stock for commodity #{grn_item.commodity_id}"
        )
        raise ActiveRecord::RecordInvalid, @inspection
      end

      def apply_stock_loss(grn_item, loss_qty)
        InventoryLedger.apply_adjustment!(
          warehouse: @inspection.warehouse,
          item: grn_item,
          quantity_delta: -loss_qty,
          transaction_date: @inspection.inspected_on,
          reference: @inspection
        )
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
