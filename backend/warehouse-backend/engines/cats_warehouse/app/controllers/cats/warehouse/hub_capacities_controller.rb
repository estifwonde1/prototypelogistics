module Cats
  module Warehouse
    class HubCapacitiesController < BaseController
      def show
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        HubCapacityRecalculator.call(hub)
        render_resource(hub.hub_capacity, serializer: HubCapacitySerializer)
      end
    end
  end
end
