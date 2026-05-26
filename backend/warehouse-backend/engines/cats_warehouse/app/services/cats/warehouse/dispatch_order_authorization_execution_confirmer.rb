# frozen_string_literal: true

module Cats
  module Warehouse
    # Transitions a storekeeper execution record from draft → confirmed.
    # Called after the storekeeper has finished recording actual dispatch quantities
    # and is ready to commit the execution for driver confirmation / GIN generation.
    class DispatchOrderAuthorizationExecutionConfirmer
      def initialize(execution:, actor:)
        @execution = execution
        @actor = actor
      end

      def call
        raise ArgumentError, "Execution must be in draft status" unless @execution.status == DispatchOrderAuthorizationExecution::DRAFT

        auth = @execution.dispatch_order_authorization
        raise ArgumentError, "Authorization must be confirmed or in progress" unless auth.confirmed? || auth.in_progress?

        DispatchOrderAuthorizationExecution.transaction do
          @execution.lock!
          raise ArgumentError, "Execution already confirmed" if @execution.status == DispatchOrderAuthorizationExecution::CONFIRMED

          @execution.update!(status: DispatchOrderAuthorizationExecution::CONFIRMED)

          WorkflowEventRecorder.record!(
            entity: auth,
            event_type: "dispatch_order_authorization.execution_confirmed",
            actor: @actor,
            from_status: auth.status,
            to_status: auth.status,
            payload: {
              execution_id: @execution.id,
              quantity: @execution.quantity,
              shortage_quantity: @execution.shortage_quantity
            }
          )

          @execution
        end
      end
    end
  end
end
