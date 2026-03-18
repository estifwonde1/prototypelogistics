module Cats
  module Warehouse
    class HubCapacitiesController < BaseController
      def show
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        render_resource(hub.hub_capacity, serializer: HubCapacitySerializer)
      end

      def create
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        capacity = HubCapacity.create!(hub: hub, **capacity_params)
        render_resource(capacity, status: :created, serializer: HubCapacitySerializer)
      end

      def update
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        capacity = hub.hub_capacity || HubCapacity.new(hub: hub)
        capacity.update!(capacity_params)
        render_resource(capacity, serializer: HubCapacitySerializer)
      end

      private

      def capacity_params
        params.require(:payload).permit(
          :total_area_sqm,
          :total_capacity_mt,
          :construction_year,
          :ownership_type
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
