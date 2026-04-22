module Cats
  module Warehouse
    class HubsController < BaseController
      def index
        authorize Hub
        render_resource(policy_scope(Hub).order(:id), each_serializer: HubSerializer)
      end

      def show
        hub = policy_scope(Hub).find(params[:id])
        authorize hub
        render_resource(hub, serializer: HubSerializer)
      end

      def create
        authorize Hub
        hub = Hub.create!(hub_params)
        render_resource(hub, status: :created, serializer: HubSerializer)
      end

      def update
        hub = policy_scope(Hub).find(params[:id])
        authorize hub
        hub.update!(hub_params)
        render_resource(hub, serializer: HubSerializer)
      end

      def destroy
        hub = policy_scope(Hub).find(params[:id])
        authorize hub
        hub.destroy!
        render_success({ id: hub.id })
      end

      private

      def hub_params
        params.require(:payload).permit(
          :location_id,
          :geo_id,
          :code,
          :name,
          :hub_type,
          :status,
          :description,
          :kebele
        )
      end
    end
  end
end
