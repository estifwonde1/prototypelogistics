module Cats
  module Warehouse
    class DispatchPlansController < BaseController
      def index
        authorize :dispatch_plan, :index?, policy_class: DispatchPlanPolicy
        scope = policy_scope(DispatchPlan, policy_scope_class: DispatchPlanPolicy::Scope)
          .includes(:dispatch_plan_items)
          .order(created_at: :desc)
        render_resource(scope, each_serializer: DispatchPlanSerializer)
      end

      def show
        dispatch_plan = policy_scope(DispatchPlan, policy_scope_class: DispatchPlanPolicy::Scope)
          .includes(dispatch_plan_items: :hub_authorizations)
          .find(params[:id])
        authorize dispatch_plan, :show?, policy_class: DispatchPlanPolicy
        render_resource(dispatch_plan, serializer: DispatchPlanSerializer)
      end

      def create
        authorize :dispatch_plan, :create?, policy_class: DispatchPlanPolicy
        payload = dispatch_plan_params
        dispatch_plan = DispatchPlan.create!(
          reference_no: payload[:reference_no],
          description: payload[:description],
          status: payload[:status].presence || "Draft",
          dispatchable_type: payload[:dispatchable_type],
          dispatchable_id: payload[:dispatchable_id],
          upstream: payload[:upstream],
          prepared_by: Cats::Core::User.find(payload[:prepared_by_id]),
          approved_by_id: payload[:approved_by_id]
        )
        render_resource(dispatch_plan, status: :created, serializer: DispatchPlanSerializer)
      end

      def update
        dispatch_plan = policy_scope(DispatchPlan, policy_scope_class: DispatchPlanPolicy::Scope).find(params[:id])
        authorize dispatch_plan, :update?, policy_class: DispatchPlanPolicy
        dispatch_plan.update!(dispatch_plan_params.except(:prepared_by_id))
        render_resource(dispatch_plan, serializer: DispatchPlanSerializer)
      end

      def approve
        dispatch_plan = policy_scope(DispatchPlan, policy_scope_class: DispatchPlanPolicy::Scope).find(params[:id])
        authorize dispatch_plan, :approve?, policy_class: DispatchPlanPolicy
        approver_id = params.require(:payload).permit(:approved_by_id)[:approved_by_id]
        dispatch_plan.update!(status: "Approved", approved_by_id: approver_id)
        render_resource(dispatch_plan, serializer: DispatchPlanSerializer)
      end

      private

      def dispatch_plan_params
        params.require(:payload).permit(
          :reference_no,
          :description,
          :status,
          :dispatchable_type,
          :dispatchable_id,
          :upstream,
          :prepared_by_id,
          :approved_by_id
        )
      end
    end
  end
end
