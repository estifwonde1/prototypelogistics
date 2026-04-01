module Cats
  module Warehouse
    class StockReservation < ApplicationRecord
      self.table_name = "cats_warehouse_stock_reservations"

      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :dispatch_order_line, class_name: "Cats::Warehouse::DispatchOrderLine"
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true
      belongs_to :reserved_by, class_name: "Cats::Core::User"

      validates :reserved_quantity, numericality: { greater_than: 0 }
      validates :issued_quantity, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
      validates :status, presence: true
    end
  end
end
