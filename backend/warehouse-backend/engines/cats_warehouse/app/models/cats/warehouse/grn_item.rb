module Cats
  module Warehouse
    class GrnItem < ApplicationRecord
      self.table_name = "cats_warehouse_grn_items"

      belongs_to :grn, class_name: "Cats::Warehouse::Grn"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true
    end
  end
end
