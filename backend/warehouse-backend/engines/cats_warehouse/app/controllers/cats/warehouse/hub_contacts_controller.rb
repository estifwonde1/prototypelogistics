module Cats
  module Warehouse
    class HubContactsController < BaseController
      def show
        hub = policy_scope(Hub).find(params[:hub_id])
        authorize hub
        render_success(hub_contacts: hub.live_hub_contact_payload)
      end
    end
  end
end
