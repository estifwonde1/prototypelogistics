module Cats
  module Warehouse
    class HubInfrasController < BaseController
      def show
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        render_resource(hub.hub_infra, serializer: HubInfraSerializer)
      end

      def create
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        infra = HubInfra.create!(hub: hub, **infra_params)
        render_resource(infra, status: :created, serializer: HubInfraSerializer)
      end

      def update
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        infra = hub.hub_infra || HubInfra.new(hub: hub)
        infra.update!(infra_params)
        render_resource(infra, serializer: HubInfraSerializer)
      end

      private

      def infra_params
        params.require(:payload).permit(
          :floor_type,
          :roof_type,
          :has_ventilation,
          :has_drainage_system,
          :has_fumigation_facility,
          :has_pest_control,
          :has_fire_extinguisher,
          :has_security_guard,
          :security_type
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
