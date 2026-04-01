module Cats
  module Warehouse
    class ReceiptOrderAssignment < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_order_assignments"

      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"
      belongs_to :receipt_order_line, class_name: "Cats::Warehouse::ReceiptOrderLine", optional: true
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :assigned_by, class_name: "Cats::Core::User"
      belongs_to :assigned_to, class_name: "Cats::Core::User", optional: true

      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :nullify

      validates :status, presence: true
    end
  end
end
