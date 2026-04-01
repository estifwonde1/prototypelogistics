module Cats
  module Warehouse
    class GrnConfirmer
      def initialize(grn:, approved_by: nil)
        @grn = grn
        @approved_by = approved_by
      end

      def call
        @grn.ensure_confirmable!

        Grn.transaction do
          old_status = @grn.status
          @grn.update!(
            status: "Confirmed",
            approved_by: @approved_by || @grn.approved_by,
            workflow_status: "Confirmed"
          )

          @grn.grn_items.find_each do |item|
            InventoryLedger.apply_receipt!(
              warehouse: @grn.warehouse,
              item: item,
              transaction_date: @grn.received_on,
              reference: @grn
            )
          end

          if @grn.receipt_order.present?
            order_old_status = @grn.receipt_order.status
            @grn.receipt_order.update!(status: "Completed")
            WorkflowEventRecorder.record!(entity: @grn.receipt_order, event_type: "receipt_order.completed", actor: @approved_by || @grn.approved_by, from_status: order_old_status, to_status: @grn.receipt_order.status, payload: { grn_id: @grn.id })
          end

          WorkflowEventRecorder.record!(entity: @grn, event_type: "grn.confirmed", actor: @approved_by || @grn.approved_by, from_status: old_status, to_status: @grn.status)

          enqueue_notification("grn.confirmed", grn_id: @grn.id)

          @grn
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
