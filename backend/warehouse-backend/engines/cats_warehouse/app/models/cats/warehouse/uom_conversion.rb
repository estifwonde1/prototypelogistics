module Cats
  module Warehouse
    class UomConversion < ApplicationRecord
      self.table_name = "cats_warehouse_uom_conversions"

      belongs_to :commodity, class_name: "Cats::Core::Commodity", optional: true
      belongs_to :from_unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :to_unit, class_name: "Cats::Core::UnitOfMeasure"

      validates :multiplier, presence: true, numericality: { greater_than: 0 }
      validates :from_unit_id, uniqueness: { scope: [:to_unit_id, :commodity_id], message: "conversion already exists" }
      scope :active_only, -> { where(active: true) }
    end
  end
end
