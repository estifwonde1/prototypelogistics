module Cats
  module Warehouse
    class GinConfirmer
      def initialize(gin:, approved_by: nil)
        @gin = gin
        @approved_by = approved_by
      end

      def call
        @gin.ensure_confirmable!

        Gin.transaction do
          old_status = @gin.status
          @gin.update!(
            status: "Confirmed",
            approved_by: @approved_by || @gin.approved_by,
            workflow_status: "Confirmed"
          )

          @gin.gin_items.find_each do |item|
            InventoryLedger.apply_issue!(
              warehouse: @gin.warehouse,
              item: item,
              transaction_date: @gin.issued_on,
              reference: @gin
            )

            matching_reservations = StockReservation.where(
              dispatch_order_id: @gin.dispatch_order_id,
              warehouse_id: @gin.warehouse_id,
              store_id: item.store_id,
              stack_id: item.stack_id,
              commodity_id: item.commodity_id,
              unit_id: item.unit_id,
              inventory_lot_id: item.inventory_lot_id
            )

            matching_reservations.find_each do |reservation|
              reservation.issued_quantity = reservation.issued_quantity.to_f + item.quantity.to_f
              reservation.status = "Consumed" if reservation.issued_quantity.to_f >= reservation.reserved_quantity.to_f
              reservation.save!
            end
          end

          if @gin.dispatch_order.present?
            order_old_status = @gin.dispatch_order.status
            @gin.dispatch_order.update!(status: "Completed")
            WorkflowEventRecorder.record!(entity: @gin.dispatch_order, event_type: "dispatch_order.completed", actor: @approved_by || @gin.approved_by, from_status: order_old_status, to_status: @gin.dispatch_order.status, payload: { gin_id: @gin.id })
          end

          WorkflowEventRecorder.record!(entity: @gin, event_type: "gin.confirmed", actor: @approved_by || @gin.approved_by, from_status: old_status, to_status: @gin.status)

          enqueue_notification("gin.confirmed", gin_id: @gin.id)

          @gin
        end
      end

      private
      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
