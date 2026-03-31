module Cats
  module Warehouse
    class DispatchOrder < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_orders"

      include DocumentLifecycle

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :created_by, class_name: "Cats::Core::User"
      belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :destination, polymorphic: true, optional: true

      has_many :dispatch_order_lines, class_name: "Cats::Warehouse::DispatchOrderLine", dependent: :destroy
      has_many :waybills, class_name: "Cats::Warehouse::Waybill"
      has_many :gins, class_name: "Cats::Warehouse::Gin"

      validates :reference_no, presence: true, uniqueness: true
      validates :dispatched_date, presence: true

      def ensure_confirmable!
        super
        raise ArgumentError, "Dispatch order has no lines" if dispatch_order_lines.empty?
      end
    end
  end
end
