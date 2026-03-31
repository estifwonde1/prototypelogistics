module Cats
  module Warehouse
    class DispatchPlanItemsController < BaseController
      def index
        authorize :dispatch_plan_item, :index?, policy_class: DispatchPlanItemPolicy
        scope = policy_scope(DispatchPlanItem, policy_scope_class: DispatchPlanItemPolicy::Scope)
          .includes(:hub_authorizations)
          .order(created_at: :desc)
        scope = scope.where(dispatch_plan_id: params[:dispatch_plan_id]) if params[:dispatch_plan_id].present?
        render_resource(scope, each_serializer: DispatchPlanItemSerializer)
      end

      def show
        item = policy_scope(DispatchPlanItem, policy_scope_class: DispatchPlanItemPolicy::Scope)
          .includes(:hub_authorizations)
          .find(params[:id])
        authorize item, :show?, policy_class: DispatchPlanItemPolicy
        render_resource(item, serializer: DispatchPlanItemSerializer)
      end

      def create
        authorize :dispatch_plan_item, :create?, policy_class: DispatchPlanItemPolicy
        payload = dispatch_plan_item_params
        item = DispatchPlanItem.create!(
          reference_no: payload[:reference_no],
          dispatch_plan: DispatchPlan.find(payload[:dispatch_plan_id]),
          source_id: payload[:source_id],
          destination_id: payload[:destination_id],
          commodity_id: payload[:commodity_id],
          quantity: payload[:quantity],
          unit_id: payload[:unit_id],
          commodity_status: payload[:commodity_status].presence || "Good",
          status: payload[:status].presence || DispatchPlanItem::STATUS_UNAUTHORIZED,
          beneficiaries: payload[:beneficiaries]
        )
        render_resource(item, status: :created, serializer: DispatchPlanItemSerializer)
      end

      def update
        item = policy_scope(DispatchPlanItem, policy_scope_class: DispatchPlanItemPolicy::Scope).find(params[:id])
        authorize item, :update?, policy_class: DispatchPlanItemPolicy
        item.update!(dispatch_plan_item_params)
        render_resource(item, serializer: DispatchPlanItemSerializer)
      end

      private

      def dispatch_plan_item_params
        params.require(:payload).permit(
          :reference_no,
          :dispatch_plan_id,
          :source_id,
          :destination_id,
          :commodity_id,
          :quantity,
          :unit_id,
          :commodity_status,
          :status,
          :beneficiaries
        )
      end
    end
  end
end
