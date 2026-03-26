module Cats
  module Warehouse
    class HubInfrasController < BaseController
      def show
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        render_resource(hub.hub_infra, serializer: HubInfraSerializer)
      end

      def create
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        infra = HubInfra.create!(hub: hub, **infra_params)
        render_resource(infra, status: :created, serializer: HubInfraSerializer)
      end

      def update
        hub = policy_scope(Hub).find(params[:hub_id])
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
    end
  end
end
