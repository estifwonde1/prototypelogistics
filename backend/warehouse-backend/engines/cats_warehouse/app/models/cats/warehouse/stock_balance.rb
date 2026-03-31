module Cats
  module Warehouse
    class StockBalance < ApplicationRecord
      self.table_name = "cats_warehouse_stock_balances"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true
      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      validates :quantity, presence: true
      validates :quantity, numericality: { greater_than_or_equal_to: 0 }
      validates :base_quantity, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
      validates :commodity_id, uniqueness: {
        scope: [ :warehouse_id, :store_id, :stack_id, :unit_id, :inventory_lot_id ],
        message: "already has a balance for this combination including Lot"
      }
    end
  end
end
