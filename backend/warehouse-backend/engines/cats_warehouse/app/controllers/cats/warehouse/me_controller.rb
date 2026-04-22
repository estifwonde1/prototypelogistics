module Cats
  module Warehouse
    class MeController < BaseController
      skip_after_action :verify_authorized

      # GET /v1/me/assignments
      # Returns the current user's role assignments with location/hub/warehouse info.
      def assignments
        scope = UserAssignment.includes(:hub, :warehouse, :store, :location)
                              .where(user_id: current_user.id)

        render_success(assignments: scope.map { |a| assignment_payload(a) })
      end

      private

      def assignment_payload(a)
        {
          id: a.id,
          role_name: a.role_name,
          hub: a.hub && { id: a.hub.id, name: a.hub.name },
          warehouse: a.warehouse && { id: a.warehouse.id, name: a.warehouse.name },
          store: a.store && { id: a.store.id, name: a.store.name },
          location: a.location && { id: a.location.id, name: a.location.name, location_type: a.location.location_type }
        }
      end
    end
  end
end
