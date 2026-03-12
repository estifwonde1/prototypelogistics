module Cats
  module Warehouse
    class HubAccess < ApplicationRecord
      self.table_name = "cats_warehouse_hub_access"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"
    end
  end
end
