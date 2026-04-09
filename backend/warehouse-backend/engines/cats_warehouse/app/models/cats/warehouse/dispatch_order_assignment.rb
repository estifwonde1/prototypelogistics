module Cats
  module Warehouse
    class DispatchOrderAssignment < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_assignments"

      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :dispatch_order_line, class_name: "Cats::Warehouse::DispatchOrderLine", optional: true
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :assigned_by, class_name: "Cats::Core::User"
      belongs_to :assigned_to, class_name: "Cats::Core::User", optional: true

      validates :status, presence: true
    end
  end
end
