module Cats
  module Warehouse
    module Admin
      class RolesController < BaseController
        skip_after_action :verify_authorized, raise: false

        # GET /admin/roles
        def index
          roles = Cats::Core::Role.where(application_module_id: application_module.id).order(:name)
          render_success(roles: roles.map { |r| role_payload(r) })
        end

        # POST /admin/roles
        def create
          role_name = params.dig(:role, :name)&.strip
          if role_name.blank?
            return render_error("Role name is required", status: :unprocessable_entity)
          end

          if Cats::Core::Role.exists?(application_module_id: application_module.id, name: role_name)
            return render_error("Role '#{role_name}' already exists", status: :unprocessable_entity)
          end

          role = Cats::Core::Role.create!(
            name: role_name,
            application_module_id: application_module.id
          )

          render_success({ role: role_payload(role) }, status: :created)
        end

        # DELETE /admin/roles/:id
        def destroy
          role = Cats::Core::Role.find_by(id: params[:id], application_module_id: application_module.id)

          unless role
            return render_error("Role not found", status: :not_found)
          end

          # Prevent deletion if any active users are assigned this role
          active_user_count = Cats::Core::User
            .joins(:roles)
            .where(cats_core_roles: { id: role.id })
            .where(active: true)
            .count

          if active_user_count > 0
            return render_error(
              "Cannot delete role '#{role.name}': #{active_user_count} active user(s) are assigned this role. " \
              "Please reassign or deactivate those users first.",
              status: :unprocessable_entity
            )
          end

          role.destroy!
          render_success({ id: role.id })
        end

        private

        def application_module
          @application_module ||= warehouse_module
        end

        def role_payload(role)
          { id: role.id, name: role.name }
        end
      end
    end
  end
end
