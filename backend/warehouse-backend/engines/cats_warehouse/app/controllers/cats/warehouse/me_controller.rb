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

      # POST /v1/me/switch_role
      # Records an audit event when the user switches their active role/workspace.
      # The actual role state lives on the frontend; this endpoint only writes the audit log.
      def switch_role
        assignment_id = params.dig(:payload, :assignment_id)
        from_role     = params.dig(:payload, :from_role).to_s.strip
        to_role       = params.dig(:payload, :to_role).to_s.strip
        facility_name = params.dig(:payload, :facility_name).to_s.strip

        if assignment_id.blank? || to_role.blank?
          return render_error("assignment_id and to_role are required", status: :unprocessable_entity)
        end

        # Verify the target assignment actually belongs to this user
        assignment = UserAssignment.find_by(id: assignment_id, user_id: current_user.id)
        unless assignment
          return render_error("Assignment not found or does not belong to you", status: :not_found)
        end

        WorkflowEventRecorder.record!(
          entity:      current_user,
          event_type:  "role_switch",
          actor:       current_user,
          from_status: from_role.presence,
          to_status:   to_role,
          payload:     {
            assignment_id: assignment.id,
            facility_name: facility_name.presence || resolve_facility_name(assignment),
            switched_at:   Time.current.iso8601
          }
        )

        render_success({ switched: true, to_role: to_role })
      end

      # GET /v1/me/storekeeper_stores
      # Returns only the stores explicitly assigned to the current user as a
      # Storekeeper. Warehouse Manager access never implies storekeeper access.
      def storekeeper_stores
        stores = Store.includes(:warehouse)
                      .where(
                        id: UserAssignment
                          .where(user_id: current_user.id, role_name: "Storekeeper")
                          .where.not(store_id: nil)
                          .select(:store_id)
                      )
                      .order(:name)

        render_success(stores: stores.map { |s|
          {
            id:            s.id,
            name:          s.name,
            warehouse_id:  s.warehouse_id,
            warehouse_name: s.warehouse&.name
          }
        })
      end

      private

      def resolve_facility_name(assignment)
        return assignment.hub.name          if assignment.hub.present?
        return assignment.warehouse.name    if assignment.warehouse.present?
        return assignment.store.name        if assignment.store.present?
        return assignment.location.name     if assignment.location.present?

        "Federal"
      end

      def assignment_payload(a)
        # For store-level storekeeper assignments, also include the parent warehouse
        # so the frontend can resolve the warehouse_id without an extra API call.
        effective_warehouse = a.warehouse || (a.store&.warehouse)

        {
          id: a.id,
          role_name: a.role_name,
          hub: a.hub && { id: a.hub.id, name: a.hub.name },
          warehouse: effective_warehouse && {
            id: effective_warehouse.id,
            name: effective_warehouse.name,
            hub_id: effective_warehouse.hub_id
          },
          store: a.store && { id: a.store.id, name: a.store.name },
          location: a.location && { id: a.location.id, name: a.location.name, location_type: a.location.location_type }
        }
      end
    end
  end
end
