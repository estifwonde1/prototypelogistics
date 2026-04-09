module Cats
  module Warehouse
    class WaybillPreparationService
      def initialize(waybill:, actor:)
        @waybill = waybill
        @actor = actor
      end

      def call
        return @waybill unless @waybill.dispatch_order.present?

        old_status = @waybill.dispatch_order.status
        @waybill.update!(prepared_by: @actor, workflow_status: "Prepared")
        @waybill.dispatch_order.update!(status: "In Progress") if @waybill.dispatch_order.status_assigned? || @waybill.dispatch_order.status_reserved? || @waybill.dispatch_order.status_confirmed?
        WorkflowEventRecorder.record!(entity: @waybill.dispatch_order, event_type: "dispatch_order.waybill_prepared", actor: @actor, from_status: old_status, to_status: @waybill.dispatch_order.status, payload: { waybill_id: @waybill.id })
        @waybill
      end
    end
  end
end
