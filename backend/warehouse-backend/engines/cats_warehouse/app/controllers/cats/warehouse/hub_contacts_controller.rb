module Cats
  module Warehouse
    class HubContactsController < BaseController
      def show
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        render_resource(hub.hub_contacts, serializer: HubContactsSerializer)
      end

      def create
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        contacts = HubContacts.create!(hub: hub, **contacts_params)
        render_resource(contacts, status: :created, serializer: HubContactsSerializer)
      end

      def update
        hub = scoped_hubs.find(params[:hub_id])
        authorize hub
        contacts = hub.hub_contacts || HubContacts.new(hub: hub)
        contacts.update!(contacts_params)
        render_resource(contacts, serializer: HubContactsSerializer)
      end

      private

      def contacts_params
        params.require(:payload).permit(
          :manager_name,
          :contact_phone,
          :contact_email
        )
      end

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
