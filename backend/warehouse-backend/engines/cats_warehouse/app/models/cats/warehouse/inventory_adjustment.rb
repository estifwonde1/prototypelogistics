module Cats
  module Warehouse
    class InventoryAdjustment < ApplicationRecord
      self.table_name = "cats_warehouse_inventory_adjustments"

      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :stack, class_name: "Cats::Warehouse::Stack"

      validates :adjustment_date, presence: true
      # quantity is signed: positive = stock increase, negative = stock decrease.
      # nil is allowed on draft records before the value is entered.
      validates :quantity, numericality: true, allow_nil: true
    end
  end
end
