module Cats
  module Warehouse
    class InspectionConfirmer
      def initialize(inspection:)
        @inspection = inspection
      end

      def call
        raise ArgumentError, "Inspection is already confirmed" if @inspection.status == "Confirmed"

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

          apply_stock_loss(grn_item, loss_qty)
        end
      end

      def apply_stock_loss(grn_item, loss_qty)
        balance = StockBalance.find_or_initialize_by(
          warehouse_id: @inspection.warehouse_id,
          store_id: grn_item.store_id,
          stack_id: grn_item.stack_id,
          commodity_id: grn_item.commodity_id,
          unit_id: grn_item.unit_id
        )
        balance.quantity = balance.quantity.to_f - loss_qty
        balance.save!

        return unless grn_item.stack_id

        stack = Stack.lock.find(grn_item.stack_id)
        stack.quantity = stack.quantity.to_f - loss_qty
        stack.save!

        StackTransaction.create!(
          source_id: grn_item.stack_id,
          destination_id: grn_item.stack_id,
          transaction_date: @inspection.inspected_on,
          quantity: loss_qty,
          unit_id: grn_item.unit_id,
          status: "Confirmed"
        )
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
