module Cats
  module Warehouse
    class ReceiptOrder < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_orders"

      include DocumentLifecycle

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :created_by, class_name: "Cats::Core::User"
      belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :source, polymorphic: true, optional: true

      has_many :receipt_order_lines, class_name: "Cats::Warehouse::ReceiptOrderLine", dependent: :destroy
      has_many :inspections, class_name: "Cats::Warehouse::Inspection"
      has_many :grns, class_name: "Cats::Warehouse::Grn"

      validates :reference_no, presence: true, uniqueness: true
      validates :received_date, presence: true

      def ensure_confirmable!
        super
        raise ArgumentError, "Receipt order has no lines" if receipt_order_lines.empty?
      end
    end
  end
end
