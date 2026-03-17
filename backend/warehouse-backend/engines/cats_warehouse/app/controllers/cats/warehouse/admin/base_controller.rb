module Cats
  module Warehouse
    module Admin
      class BaseController < Cats::Warehouse::BaseController
        skip_after_action :verify_authorized
        before_action :require_admin!

        private

        def require_admin!
          return if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

          render_error("Not authorized", status: :forbidden)
        end
      end
    end
  end
end
