module Cats
  module Warehouse
    class StackTransaction < ApplicationRecord
      self.table_name = "cats_warehouse_stack_transactions"

      belongs_to :source, class_name: "Cats::Warehouse::Stack"
      belongs_to :destination, class_name: "Cats::Warehouse::Stack"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
    end
  end
end
