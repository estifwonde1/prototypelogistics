module Cats
  module Warehouse
    module Admin
      class UserAssignmentsController < BaseController
        skip_after_action :verify_authorized, raise: false

        def index
          scope = Cats::Warehouse::UserAssignment.includes(:user, :hub, :warehouse, :store, :location)
          scope = scope.where(role_name: params[:role_name]) if params[:role_name].present?
          scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
          scope = scope.where(hub_id: params[:hub_id]) if params[:hub_id].present?
          scope = scope.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
          scope = scope.where(store_id: params[:store_id]) if params[:store_id].present?
          scope = scope.where(location_id: params[:location_id]) if params[:location_id].present?

          render_success(assignments: scope.map { |a| assignment_payload(a) })
        end

        def create
          payload = assignment_params
          user = Cats::Core::User.find(payload[:user_id])
          role_name = payload[:role_name]

          unless valid_role_name?(role_name)
            return render_error("Invalid role_name", status: :unprocessable_entity)
          end

          ids = assignment_ids_for(role_name, payload)
          if ids.empty?
            if role_name == "Federal Officer"
              assignment = find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name)
              return render_success(assignments: [assignment_payload(assignment)], status: :created)
            end

            return render_error("No locations selected for assignment", status: :unprocessable_entity)
          end

          assignments = ids.map do |id|
            attrs = { user: user, role_name: role_name }
            case role_name
            when "Hub Manager"
              attrs[:hub_id] = id
            when "Warehouse Manager"
              attrs[:warehouse_id] = id
            when "Storekeeper"
              # Admin assigns at warehouse level
              attrs[:warehouse_id] = id
            when "Officer"
              attrs[:warehouse_id] = id
            when "Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer"
              attrs[:location_id] = id
            end

            find_or_create_with(Cats::Warehouse::UserAssignment, attrs)
          end

          if role_name == "Hub Manager"
            assignments.each { |assignment| sync_hub_manager_contacts!(user, assignment.hub_id) }
          end

          render_success(assignments: assignments.map { |a| assignment_payload(a) }, status: :created)
        end

        def bulk_update
          payload = bulk_params
          user = Cats::Core::User.find(payload[:user_id])
          role_name = payload[:role_name]
          unless valid_role_name?(role_name)
            return render_error("Invalid role_name", status: :unprocessable_entity)
          end
          ids = assignment_ids_for(role_name, payload)

          if ids.empty?
            if role_name == "Federal Officer"
              Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).delete_all
              assignment = find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name)
              return render_success(assignments: [assignment_payload(assignment)])
            end

            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).delete_all
            return render_success(assignments: [])
          end

          case role_name
          when "Hub Manager"
            existing_ids = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).pluck(:hub_id)
            create_ids = ids - existing_ids
            delete_ids = existing_ids - ids
            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name, hub_id: delete_ids).delete_all if delete_ids.any?
            create_ids.each do |id|
              find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name, hub_id: id)
            end
            ids.each { |id| sync_hub_manager_contacts!(user, id) }
          when "Warehouse Manager"
            existing_ids = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).pluck(:warehouse_id)
            create_ids = ids - existing_ids
            delete_ids = existing_ids - ids
            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name, warehouse_id: delete_ids).delete_all if delete_ids.any?
            create_ids.each { |id| find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name, warehouse_id: id) }
          when "Officer"
            existing_ids = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).pluck(:warehouse_id)
            create_ids = ids - existing_ids
            delete_ids = existing_ids - ids
            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name, warehouse_id: delete_ids).delete_all if delete_ids.any?
            create_ids.each { |id| find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name, warehouse_id: id) }
          when "Storekeeper"
            # Admin assigns at warehouse level
            existing_ids = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).pluck(:warehouse_id).compact
            create_ids = ids - existing_ids
            delete_ids = existing_ids - ids
            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name, warehouse_id: delete_ids).delete_all if delete_ids.any?
            create_ids.each { |id| find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name, warehouse_id: id) }
          when "Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer"
            existing_ids = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).pluck(:location_id)
            create_ids = ids - existing_ids
            delete_ids = existing_ids - ids
            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name, location_id: delete_ids).delete_all if delete_ids.any?
            create_ids.each { |id| find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name, location_id: id) }
          when "Federal Officer"
            Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name).delete_all
            find_or_create_with(Cats::Warehouse::UserAssignment, user: user, role_name: role_name)
          end

          assignments = Cats::Warehouse::UserAssignment.where(user_id: user.id, role_name: role_name)
          render_success(assignments: assignments.map { |a| assignment_payload(a) })
        end

        def destroy
          assignment = Cats::Warehouse::UserAssignment.find(params[:id])
          assignment.destroy!
          render_success({ id: assignment.id })
        end

        private

        def assignment_params
          params.require(:payload).permit(
            :user_id,
            :role_name,
            hub_ids: [],
            warehouse_ids: [],
            store_ids: [],
            location_ids: []
          )
        end

        def bulk_params
          assignment_params
        end

        def assignment_ids_for(role_name, payload)
          case role_name
          when "Hub Manager"
            payload[:hub_ids].to_a
          when "Warehouse Manager"
            payload[:warehouse_ids].to_a
          when "Storekeeper"
            # Admin assigns at warehouse level, WM assigns at store level
            payload[:warehouse_ids].to_a
          when "Officer"
            payload[:warehouse_ids].to_a
          when "Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer"
            payload[:location_ids].to_a
          else
            []
          end
        end

        def valid_role_name?(role_name)
          ["Hub Manager", "Warehouse Manager", "Storekeeper", "Officer", "Federal Officer", "Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer"].include?(role_name)
        end

        def assignment_payload(assignment)
          {
            id: assignment.id,
            role_name: assignment.role_name,
            user: assignment.user && { id: assignment.user.id, name: "#{assignment.user.first_name} #{assignment.user.last_name}", email: assignment.user.email },
            hub: assignment.hub && { id: assignment.hub.id, name: assignment.hub.name },
            warehouse: assignment.warehouse && { id: assignment.warehouse.id, name: assignment.warehouse.name },
            store: assignment.store && { id: assignment.store.id, name: assignment.store.name },
            location: assignment.location && { id: assignment.location.id, name: assignment.location.name }
          }
        end

        def find_or_create_with(model, attrs)
          record = model.find_or_initialize_by(attrs)
          record.save! if record.new_record?
          record
        end

        def sync_hub_manager_contacts!(user, hub_id)
          return if hub_id.blank?

          hub = Cats::Warehouse::Hub.find_by(id: hub_id)
          return unless hub

          contacts = hub.hub_contacts || Cats::Warehouse::HubContacts.new(hub: hub)
          manager_name = [user.first_name, user.last_name].compact.join(" ").strip
          manager_name = user.email if manager_name.empty?
          contacts.manager_name = manager_name
          contacts.contact_phone = user.phone_number if user.phone_number.present?
          contacts.contact_email = user.email if user.email.present?
          contacts.save!
        end
      end
    end
  end
end
