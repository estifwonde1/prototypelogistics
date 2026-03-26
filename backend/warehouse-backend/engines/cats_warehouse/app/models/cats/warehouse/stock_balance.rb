module Cats
  module Warehouse
    class StockBalance < ApplicationRecord
      self.table_name = "cats_warehouse_stock_balances"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      validates :quantity, presence: true
      validates :quantity, numericality: { greater_than_or_equal_to: 0 }
      validates :commodity_id, uniqueness: {
        scope: [ :warehouse_id, :store_id, :stack_id, :unit_id ],
        message: "already has a balance for this warehouse/store/stack/unit combination"
      }
    end
  end
end
