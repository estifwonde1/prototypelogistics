module Cats
  module Warehouse
    class HubContacts < ApplicationRecord
      self.table_name = "cats_warehouse_hub_contacts"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"

      validates :manager_name, presence: true
      validates :contact_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
    end
  end
end
