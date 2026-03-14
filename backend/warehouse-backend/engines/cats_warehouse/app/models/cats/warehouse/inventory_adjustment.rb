module Cats
  module Warehouse
    class InventoryAdjustment < ApplicationRecord
      self.table_name = "cats_warehouse_inventory_adjustments"

      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :stack, class_name: "Cats::Warehouse::Stack"

      validates :adjustment_date, presence: true
    end
  end
end
