module Cats
  module Warehouse
    class InspectionItem < ApplicationRecord
      self.table_name = "cats_warehouse_inspection_items"

      belongs_to :inspection, class_name: "Cats::Warehouse::Inspection"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
    end
  end
end
