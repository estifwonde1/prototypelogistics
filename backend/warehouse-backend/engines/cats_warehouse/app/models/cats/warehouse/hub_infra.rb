module Cats
  module Warehouse
    class HubInfra < ApplicationRecord
      self.table_name = "cats_warehouse_hub_infra"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"
    end
  end
end
