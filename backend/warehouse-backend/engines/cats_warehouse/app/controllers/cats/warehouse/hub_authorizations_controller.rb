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
        resolved_store_id = ensure_core_store_id!(payload[:store_id])
        authorization = HubAuthorization.create!(
          dispatch_plan_item_id: payload[:dispatch_plan_item_id],
          store_id: resolved_store_id,
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

      def ensure_core_store_id!(warehouse_store_id)
        store_id = warehouse_store_id.to_i
        return store_id if Cats::Core::Store.exists?(id: store_id)

        warehouse_store = Store.includes(:warehouse).find(store_id)
        core_warehouse_location_id = warehouse_store.warehouse&.location_id
        raise ActiveRecord::RecordInvalid, "Selected store warehouse has no linked core location" if core_warehouse_location_id.blank?

        existing_core_store = Cats::Core::Store.find_by(code: warehouse_store.code, warehouse_id: core_warehouse_location_id)
        return existing_core_store.id if existing_core_store

        core_store_attributes = {
          id: warehouse_store.id,
          code: warehouse_store.code,
          name: warehouse_store.name,
          length: warehouse_store.length,
          width: warehouse_store.width,
          height: warehouse_store.height,
          usable_space: warehouse_store.usable_space,
          available_space: warehouse_store.available_space,
          temporary: warehouse_store.temporary,
          has_gangway: warehouse_store.has_gangway,
          gangway_length: warehouse_store.gangway_length,
          gangway_width: warehouse_store.gangway_width,
          gangway_corner_dist: warehouse_store.gangway_corner_dist,
          warehouse_id: core_warehouse_location_id
        }

        Cats::Core::Store.create!(core_store_attributes).id
      rescue ActiveRecord::RecordNotUnique
        Cats::Core::Store.find_by!(code: warehouse_store.code, warehouse_id: core_warehouse_location_id).id
      end
    end
  end
end
