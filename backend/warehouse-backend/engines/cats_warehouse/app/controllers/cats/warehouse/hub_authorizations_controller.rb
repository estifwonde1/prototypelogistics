module Cats
  module Warehouse
    class HubAuthorizationsController < BaseController
      def index
        authorize :hub_authorization, :index?, policy_class: HubAuthorizationPolicy
        scope = policy_scope(HubAuthorization, policy_scope_class: HubAuthorizationPolicy::Scope).order(created_at: :desc)
        scope = scope.where(dispatch_plan_item_id: params[:dispatch_plan_item_id]) if params[:dispatch_plan_item_id].present?
        render_resource(scope, each_serializer: HubAuthorizationSerializer)
      end

      def show
        authorization = policy_scope(HubAuthorization, policy_scope_class: HubAuthorizationPolicy::Scope).find(params[:id])
        authorize authorization, :show?, policy_class: HubAuthorizationPolicy
        render_resource(authorization, serializer: HubAuthorizationSerializer)
      end

      def create
        authorize :hub_authorization, :create?, policy_class: HubAuthorizationPolicy
        payload = hub_authorization_params
        authorization = HubAuthorization.create!(
          dispatch_plan_item_id: payload[:dispatch_plan_item_id],
          store_id: payload[:store_id],
          quantity: payload[:quantity],
          unit_id: payload[:unit_id],
          authorization_type: payload[:authorization_type],
          authorized_by_id: payload[:authorized_by_id]
        )

        if authorization.dispatch_plan_item
          DispatchPlanItemStatusRefresher.new(dispatch_plan_item: authorization.dispatch_plan_item).call
        end

        render_resource(authorization, status: :created, serializer: HubAuthorizationSerializer)
      end

      private

      def hub_authorization_params
        params.require(:payload).permit(
          :dispatch_plan_item_id,
          :store_id,
          :quantity,
          :unit_id,
          :authorization_type,
          :authorized_by_id
        )
      end
    end
  end
end
