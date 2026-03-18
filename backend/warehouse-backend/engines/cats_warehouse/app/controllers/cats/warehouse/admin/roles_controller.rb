module Cats
  module Warehouse
    module Admin
      class RolesController < BaseController
        skip_after_action :verify_authorized, raise: false

        def index
          roles = Cats::Core::Role.where(application_module_id: application_module.id).order(:name)
          render_success(roles: roles.map { |r| role_payload(r) })
        end

        private

        def application_module
          @application_module ||= Cats::Core::ApplicationModule.find_by(prefix: "CATS-WH")
        end

        def role_payload(role)
          { id: role.id, name: role.name }
        end
      end
    end
  end
end
