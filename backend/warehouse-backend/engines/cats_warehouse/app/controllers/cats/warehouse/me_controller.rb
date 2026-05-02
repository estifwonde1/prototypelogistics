module Cats
  module Warehouse
    class MeController < BaseController
      skip_after_action :verify_authorized

      # GET /v1/me/assignments
      # Returns the current user's role assignments with location/hub/warehouse info.
      def assignments
        scope = UserAssignment.includes(:hub, :warehouse, :location, store: :warehouse)
                              .where(user_id: current_user.id)

        render_success(assignments: scope.map { |a| assignment_payload(a) })
      end

      private

      def assignment_payload(a)
        # For store-level storekeeper assignments, also include the parent warehouse
        # so the frontend can resolve the warehouse_id without an extra API call.
        effective_warehouse = a.warehouse || (a.store&.warehouse)

        {
          id: a.id,
          role_name: a.role_name,
          hub: a.hub && { id: a.hub.id, name: a.hub.name },
          warehouse: effective_warehouse && { id: effective_warehouse.id, name: effective_warehouse.name },
          store: a.store && { id: a.store.id, name: a.store.name },
          location: a.location && { id: a.location.id, name: a.location.name, location_type: a.location.location_type }
        }
      end
    end
  end
end
