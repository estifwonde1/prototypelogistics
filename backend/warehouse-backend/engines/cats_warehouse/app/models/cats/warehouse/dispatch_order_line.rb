module Cats
  module Warehouse
    class DispatchOrderLine < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_lines"

      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :nullify
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :nullify

      validates :quantity, presence: true, numericality: { greater_than: 0 }
    end
  end
end
