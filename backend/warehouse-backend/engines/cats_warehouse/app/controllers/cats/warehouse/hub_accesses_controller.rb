module Cats
  module Warehouse
    class HubAccessesController < BaseController
      def show
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        render_resource(hub.hub_access, serializer: HubAccessSerializer)
      end

      def create
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        access = HubAccess.create!(hub: hub, **access_params)
        render_resource(access, status: :created, serializer: HubAccessSerializer)
      end

      def update
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        access = hub.hub_access || HubAccess.new(hub: hub)
        access.update!(access_params)
        render_resource(access, serializer: HubAccessSerializer)
      end

      private

      def access_params
        params.require(:payload).permit(
          :has_loading_dock,
          :number_of_loading_docks,
          :loading_dock_type,
          :access_road_type,
          :nearest_town,
          :distance_from_town_km,
          :has_weighbridge
        )
      end
    end
  end
end
