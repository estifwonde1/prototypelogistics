module Cats
  module Warehouse
    class WaybillConfirmer
      def initialize(waybill:, actor: nil)
        @waybill = waybill
        @actor = actor
      end

      def call
        @waybill.ensure_confirmable!

        Waybill.transaction do
          old_status = @waybill.status
          @waybill.update!(status: :confirmed, workflow_status: "confirmed")
          GinGeneratorFromWaybill.new(waybill: @waybill, actor: @actor || @waybill.prepared_by || @waybill.dispatch_order&.created_by).call if @waybill.dispatch_order.present?
          WorkflowEventRecorder.record!(entity: @waybill, event_type: "waybill.confirmed", actor: @actor || @waybill.prepared_by, from_status: old_status, to_status: @waybill.status)
          enqueue_notification("waybill.confirmed", waybill_id: @waybill.id)
          @waybill
        end
      end

      private

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
