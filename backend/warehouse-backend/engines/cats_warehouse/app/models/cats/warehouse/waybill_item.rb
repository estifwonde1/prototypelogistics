module Cats
  module Warehouse
    class WaybillItem < ApplicationRecord
      self.table_name = "cats_warehouse_waybill_items"

      belongs_to :waybill, class_name: "Cats::Warehouse::Waybill"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      validates :quantity, presence: true
    end
  end
end
