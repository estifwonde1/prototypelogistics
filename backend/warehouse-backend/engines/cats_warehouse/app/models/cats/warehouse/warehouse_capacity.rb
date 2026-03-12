module Cats
  module Warehouse
    class WarehouseCapacity < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_capacity"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
    end
  end
end
