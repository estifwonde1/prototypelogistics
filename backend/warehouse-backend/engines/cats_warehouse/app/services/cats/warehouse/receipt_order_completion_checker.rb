module Cats
  module Warehouse
    # Called after every RA transitions to closed or cancelled.
    # Completes the Receipt Order only when ALL non-cancelled RAs are closed.
    class ReceiptOrderCompletionChecker
      def initialize(receipt_order:, actor:)
        @order = receipt_order
        @actor = actor
      end

      def call
        # Get all non-cancelled RAs for this order
        active_ras = @order.receipt_authorizations.not_cancelled

        # If there are no RAs at all, do not auto-complete
        return if active_ras.empty?

        # Check if every non-cancelled RA is closed
        all_closed = active_ras.all?(&:closed?)
        return unless all_closed

        # All trucks received — complete the order
        old_status = @order.status
        @order.update!(status: "Completed")

        WorkflowEventRecorder.record!(
          entity:      @order,
          event_type:  "receipt_order.completed",
          actor:       @actor,
          from_status: old_status,
          to_status:   @order.status,
          payload:     {
            closed_ra_count: active_ras.count,
            completed_by:    @actor.id
          }
        )

        enqueue_notification("receipt_order.completed", receipt_order_id: @order.id)
      end

      private

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
