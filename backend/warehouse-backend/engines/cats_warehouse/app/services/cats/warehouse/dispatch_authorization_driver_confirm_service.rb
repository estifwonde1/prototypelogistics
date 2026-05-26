# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchAuthorizationDriverConfirmService
      def initialize(authorization:, actor:)
        @authorization = authorization
        @actor = actor
      end

      def call
        raise ArgumentError, "Authorization must be confirmed or in progress" unless @authorization.confirmed? || @authorization.in_progress?

        execution = @authorization.dispatch_order_authorization_executions.order(created_at: :desc).first
        raise ArgumentError, "No execution record found" if execution.blank?
        raise ArgumentError, "Execution quantity must be positive" unless execution.quantity.to_f.positive?

        DispatchOrderAuthorization.transaction do
          @authorization.update!(
            driver_confirmed_at: Time.current,
            driver_confirmed_by: @actor,
            status: DispatchOrderAuthorization::IN_PROGRESS
          )

          waybill = @authorization.waybill || raise(ArgumentError, "Waybill not found for authorization")
          gin = GinGeneratorFromWaybill.new(waybill: waybill, actor: @actor).call
          gin.update!(dispatch_order_authorization_id: @authorization.id)

          WorkflowEventRecorder.record!(
            entity: @authorization,
            event_type: "dispatch_order_authorization.driver_confirmed",
            actor: @actor,
            from_status: @authorization.status,
            to_status: @authorization.status,
            payload: { gin_id: gin.id }
          )

          NotificationFanout.deliver("gin.draft_generated", gin_id: gin.id, dispatch_order_authorization_id: @authorization.id)

          gin
        end
      end
    end
  end
end
