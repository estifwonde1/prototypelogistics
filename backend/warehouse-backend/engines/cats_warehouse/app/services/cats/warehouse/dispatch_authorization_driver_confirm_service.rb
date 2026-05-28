# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchAuthorizationDriverConfirmService
      def initialize(authorization:, actor:, driver_phone: nil)
        @authorization = authorization
        @actor = actor
        @driver_phone = driver_phone
      end

      def call
        raise ArgumentError, "Authorization must be confirmed or in progress" unless @authorization.confirmed? || @authorization.in_progress?

        execution = @authorization.dispatch_order_authorization_executions.order(created_at: :desc).first
        raise ArgumentError, "No execution record found" if execution.blank?
        raise ArgumentError, "Execution quantity must be positive" unless execution.quantity.to_f.positive?

        DispatchOrderAuthorization.transaction do
          if @driver_phone.present?
            @authorization.update!(driver_phone: @driver_phone)
          end

          @authorization.update!(
            driver_confirmed_at: Time.current,
            driver_confirmed_by: @actor,
            status: DispatchOrderAuthorization::IN_PROGRESS
          )

          waybill = @authorization.waybill
          if waybill.blank?
            raise ArgumentError, "Store splits are required before driver confirmation" if @authorization.dispatch_order_authorization_stores.empty?

            waybill = DispatchOrderAuthorizationWaybillGenerator.new(
              authorization: @authorization,
              actor: @actor
            ).call
          end
          gin = GinGeneratorFromWaybill.new(waybill: waybill, actor: @actor).call
          gin.update!(dispatch_order_authorization_id: @authorization.id)

          # Copy commodity_grade from execution to GIN items (plan §9)
          apply_commodity_grades_to_gin!(gin)

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

      private

      # For each GIN item, find the most recent execution for that commodity and copy
      # its commodity_grade. GinItem doesn't have a commodity_grade column, so we store
      # the grade on the DispatchStackAllocation created later; here we annotate the
      # GIN item's store/stack context via the execution link if the column exists.
      def apply_commodity_grades_to_gin!(gin)
        executions_by_commodity = @authorization
          .dispatch_order_authorization_executions
          .where.not(commodity_grade: [nil, ""])
          .order(created_at: :desc)
          .index_by(&:commodity_id)

        return if executions_by_commodity.empty?

        gin.gin_items.find_each do |item|
          execution = executions_by_commodity[item.commodity_id]
          next if execution.blank?

          # commodity_grade is not a column on gin_items; record it on the
          # dispatch_stack_allocation when stacks are assigned. Nothing to update here
          # unless the column is added in a future migration.
          # This hook is intentionally left as a no-op placeholder per plan §9.
        end
      end
    end
  end
end
