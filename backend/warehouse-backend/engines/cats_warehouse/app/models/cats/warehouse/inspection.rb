module Cats
  module Warehouse
    class Inspection < ApplicationRecord
      self.table_name = "cats_warehouse_inspections"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :inspector, class_name: "Cats::Core::User"
      belongs_to :source, polymorphic: true, optional: true

      has_many :inspection_items, class_name: "Cats::Warehouse::InspectionItem", dependent: :destroy
    end
  end
end
