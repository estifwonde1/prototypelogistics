# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationExecutionService
      def initialize(authorization:, actor:, authorization_store_id:, quantity:, commodity_grade: nil, inventory_lot_id: nil, shortage_reason: nil)
        @authorization = authorization
        @actor = actor
        @store_row = authorization.dispatch_order_authorization_stores.find(authorization_store_id)
        @quantity = quantity.to_f
        @commodity_grade = commodity_grade
        @inventory_lot_id = inventory_lot_id
        @shortage_reason = shortage_reason
      end

      def call
        raise ArgumentError, "Authorization must be confirmed or in progress" unless @authorization.confirmed? || @authorization.in_progress?

        remaining = @store_row.remaining_quantity.to_f
        raise ArgumentError, "Quantity exceeds remaining authorized amount" if @quantity > remaining + 0.001

        shortage = [remaining - @quantity, 0].max
        raise ArgumentError, "shortage_reason is required when dispatching less than authorized" if shortage.positive? && @shortage_reason.blank?

        DispatchOrderAuthorizationExecution.transaction do
          execution = DispatchOrderAuthorizationExecution.create!(
            dispatch_order_authorization: @authorization,
            dispatch_order_authorization_store: @store_row,
            storekeeper: @actor,
            commodity_id: @store_row.commodity_id,
            quantity: @quantity,
            base_quantity: @quantity,
            authorized_quantity: @store_row.authorized_quantity,
            shortage_quantity: shortage,
            shortage_reason: @shortage_reason,
            commodity_grade: @commodity_grade,
            inventory_lot_id: @inventory_lot_id,
            status: DispatchOrderAuthorizationExecution::DRAFT
          )

          @store_row.update!(
            dispatched_quantity: @store_row.dispatched_quantity.to_f + @quantity,
            remaining_quantity: [remaining - @quantity, 0].max
          )

          @authorization.update!(
            remaining_quantity: [@authorization.remaining_quantity.to_f - @quantity, 0].max,
            status: DispatchOrderAuthorization::IN_PROGRESS
          )

          DispatchOrderStatusAggregator.call(@authorization.dispatch_order)

          WorkflowEventRecorder.record!(
            entity: @authorization,
            event_type: "dispatch_order_authorization.execution_recorded",
            actor: @actor,
            from_status: @authorization.status,
            to_status: @authorization.status,
            payload: { execution_id: execution.id, shortage_quantity: shortage }
          )

          post_packaging_dispatch_transaction!(execution)

          execution
        end
      end

      private

      def post_packaging_dispatch_transaction!(execution)
        PackagingTransactionPoster.new(
          actor: @actor,
          transaction_type: PackagingTransaction::DISPATCH,
          warehouse: @authorization.warehouse,
          commodity: execution.commodity,
          quantity: execution.quantity,
          unit_id: @store_row.commodity.unit_of_measure_id,
          reference_order: @authorization.dispatch_order,
          execution_id: execution.id
        ).call
      rescue StandardError => e
        Rails.logger.warn("[DispatchOrderAuthorizationExecutionService] packaging dispatch skipped: #{e.message}")
      end
    end
  end
end
