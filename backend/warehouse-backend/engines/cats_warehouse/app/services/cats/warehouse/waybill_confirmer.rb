module Cats
  module Warehouse
    class WaybillConfirmer
      def initialize(waybill:)
        @waybill = waybill
      end

      def call
        raise ArgumentError, "Waybill is already confirmed" if @waybill.status == "Confirmed"

        Waybill.transaction do
          @waybill.update!(status: "Confirmed")
          enqueue_notification("waybill.confirmed", waybill_id: @waybill.id)
          @waybill
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
