module Cats
  module Warehouse
    class HubInfra < ApplicationRecord
      self.table_name = "cats_warehouse_hub_infra"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"

      validates :floor_type, :roof_type, presence: true
    end
  end
end
