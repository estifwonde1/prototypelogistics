module Cats
  module Warehouse
    class HubAccessesController < BaseController
      def show
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        render_resource(hub.hub_access, serializer: HubAccessSerializer)
      end

      def create
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        access = HubAccess.create!(hub: hub, **access_params)
        render_resource(access, status: :created, serializer: HubAccessSerializer)
      end

      def update
        hub = scoped_hubs.find(params[:hub_id])
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

      def scoped_hubs
        return Hub.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          return Hub.where(id: hub_ids)
        end

        Hub.none
      end
    end
  end
end
