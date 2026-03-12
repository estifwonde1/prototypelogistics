module Cats
  module Warehouse
    class StackingRule < ApplicationRecord
      self.table_name = "cats_warehouse_stacking_rules"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
    end
  end
end
