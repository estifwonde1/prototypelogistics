module Cats
  module Warehouse
    class HubContacts < ApplicationRecord
      self.table_name = "cats_warehouse_hub_contacts"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"
    end
  end
end
