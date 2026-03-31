module Cats
  module Warehouse
    class ReceiptOrderLine < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_order_lines"

      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      validates :quantity, presence: true, numericality: { greater_than: 0 }
    end
  end
end
