module Cats
  module Warehouse
    class HubContactsController < BaseController
      def show
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        render_success(hub_contacts: hub.live_hub_contact_payload)
      end

      private

      def scoped_hubs
        return Hub.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          return Hub.where(id: hub_ids)
        end

        Hub.none
      end
    end
  end
end
