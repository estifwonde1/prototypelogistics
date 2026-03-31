module Cats
  module Warehouse
    class DispatchOrderConfirmer
      def initialize(order:, confirmed_by: nil)
        @order = order
        @confirmed_by = confirmed_by
      end

      def call
        @order.ensure_confirmable!

        DispatchOrder.transaction do
          @order.update!(
            status: "Confirmed",
            confirmed_by: @confirmed_by || @order.confirmed_by
          )

          enqueue_notification("dispatch_order.confirmed", dispatch_order_id: @order.id)

          @order
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
