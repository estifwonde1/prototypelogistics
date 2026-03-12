module Cats
  module Warehouse
    class WarehouseAccess < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_access"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
    end
  end
end
