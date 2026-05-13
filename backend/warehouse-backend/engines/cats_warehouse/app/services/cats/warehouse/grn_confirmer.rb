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
            status: :confirmed,
            approved_by: @approved_by || @grn.approved_by,
            workflow_status: "confirmed"
          )

          @grn.grn_items.find_each do |item|
            InventoryLedger.apply_receipt!(
              warehouse: @grn.warehouse,
              item: item,
              transaction_date: @grn.received_on,
              reference: @grn
            )
          end

          if @grn.receipt_authorization.present?
            close_receipt_authorization_if_complete!
          elsif @grn.receipt_order.present?
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

      def close_receipt_authorization_if_complete!
        ra = @grn.receipt_authorization
        return unless ra.active?

        return unless ra.generated_inspection_grns_confirmed?

        order = ra.receipt_order
        ra.update!(status: ReceiptAuthorization::CLOSED)

        WorkflowEventRecorder.record!(
          entity:      order,
          event_type:  "receipt_authorization.closed",
          actor:       @approved_by || @grn.approved_by,
          from_status: order.status,
          to_status:   order.status,
          payload:     { receipt_authorization_id: ra.id, grn_id: @grn.id }
        )

        ReceiptOrderCompletionChecker.new(
          receipt_order: order,
          actor: @approved_by || @grn.approved_by
        ).call
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
