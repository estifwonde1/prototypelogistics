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

      # GET /v1/me/profile
      def profile
        render_success(profile: profile_payload(current_user))
      end

      # PATCH /v1/me/profile
      # Users may only update their own phone number.
      def update_profile
        payload = params.require(:payload).permit(:phone_number, :first_name, :last_name, :email, role_names: [])

        if payload[:first_name].present? || payload[:last_name].present? || payload[:email].present? || payload[:role_names].present?
          return render_error("Only phone number can be updated", status: :unprocessable_entity)
        end

        if payload[:phone_number].blank?
          return render_error("phone_number is required", status: :unprocessable_entity)
        end

        current_user.update!(phone_number: payload[:phone_number])
        render_success(profile: profile_payload(current_user))
      end

      # PATCH /v1/me/password
      def change_password
        payload = params.require(:payload).permit(:current_password, :password, :password_confirmation)

        unless current_user.authenticate(payload[:current_password].to_s)
          return render_error("Current password is incorrect", status: :unprocessable_entity)
        end

        unless payload[:password].present?
          return render_error("password is required", status: :unprocessable_entity)
        end

        unless payload[:password] == payload[:password_confirmation]
          return render_error("Password confirmation does not match", status: :unprocessable_entity)
        end

        current_user.update!(
          password: payload[:password],
          password_confirmation: payload[:password_confirmation]
        )

        render_success(changed: true)
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

      def profile_payload(user)
        {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone_number: user.phone_number,
          roles: user.roles.map(&:name)
        }
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
