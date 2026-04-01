module Cats
  module Warehouse
    class ReceiptOrderConfirmer
      def initialize(order:, confirmed_by: nil)
        @order = order
        @confirmed_by = confirmed_by
      end

      def call
        @order.ensure_confirmable!

        ReceiptOrder.transaction do
          @order.reference_no = generated_reference_no if @order.reference_no.blank?
          old_status = @order.status
          @order.update!(
            status: "Confirmed",
            confirmed_by: @confirmed_by || @order.confirmed_by,
            confirmed_at: Time.current
          )
          WorkflowEventRecorder.record!(entity: @order, event_type: "receipt_order.confirmed", actor: @confirmed_by, from_status: old_status, to_status: @order.status)

          enqueue_notification("receipt_order.confirmed", receipt_order_id: @order.id)

          @order
        end
      end

      private

      def generated_reference_no
        "RO-#{SecureRandom.hex(4).upcase}"
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
