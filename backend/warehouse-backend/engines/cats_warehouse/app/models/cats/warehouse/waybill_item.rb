module Cats
  module Warehouse
    class WaybillItem < ApplicationRecord
      self.table_name = "cats_warehouse_waybill_items"

      belongs_to :waybill, class_name: "Cats::Warehouse::Waybill"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true
      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      validates :quantity, presence: true
    end
  end
end
