module Cats
  module Warehouse
    class HubCapacity < ApplicationRecord
      self.table_name = "cats_warehouse_hub_capacity"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"
    end
  end
end
