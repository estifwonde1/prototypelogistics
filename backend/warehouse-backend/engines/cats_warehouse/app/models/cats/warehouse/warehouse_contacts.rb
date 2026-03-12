module Cats
  module Warehouse
    class WarehouseContacts < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_contacts"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
    end
  end
end
