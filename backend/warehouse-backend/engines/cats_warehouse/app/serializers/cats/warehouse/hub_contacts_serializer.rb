module Cats
  module Warehouse
    class HubContactsSerializer < ApplicationSerializer
      attributes :id, :hub_id, :manager_name, :contact_phone, :contact_email, :created_at, :updated_at
    end
  end
end
