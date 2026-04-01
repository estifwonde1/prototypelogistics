module Cats
  module Warehouse
    class SpaceReservation < ApplicationRecord
      self.table_name = "cats_warehouse_space_reservations"

      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"
      belongs_to :receipt_order_line, class_name: "Cats::Warehouse::ReceiptOrderLine"
      belongs_to :receipt_order_assignment, class_name: "Cats::Warehouse::ReceiptOrderAssignment", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :reserved_by, class_name: "Cats::Core::User"

      validates :status, presence: true
    end
  end
end
