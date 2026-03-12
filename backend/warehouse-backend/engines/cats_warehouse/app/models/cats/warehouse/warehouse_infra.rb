module Cats
  module Warehouse
    class WarehouseInfra < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_infra"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
    end
  end
end
