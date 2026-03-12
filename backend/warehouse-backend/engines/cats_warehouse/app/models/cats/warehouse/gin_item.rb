module Cats
  module Warehouse
    class GinItem < ApplicationRecord
      self.table_name = "cats_warehouse_gin_items"

      belongs_to :gin, class_name: "Cats::Warehouse::Gin"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true
    end
  end
end
