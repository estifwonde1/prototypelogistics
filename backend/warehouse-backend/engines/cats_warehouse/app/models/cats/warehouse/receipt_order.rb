module Cats
  module Warehouse
    class ReceiptOrder < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_orders"

      include DocumentLifecycle

      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :created_by, class_name: "Cats::Core::User"
      belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :source, polymorphic: true, optional: true

      has_many :receipt_order_lines, class_name: "Cats::Warehouse::ReceiptOrderLine", dependent: :destroy
      has_many :inspections, class_name: "Cats::Warehouse::Inspection"
      has_many :grns, class_name: "Cats::Warehouse::Grn"
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :destroy
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :destroy
      has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent", dependent: :destroy

      validates :reference_no, uniqueness: true, allow_blank: true
      validates :created_by, presence: true

      def ensure_confirmable!
        super
        raise ArgumentError, "Receipt order warehouse is required" if warehouse.blank?
        raise ArgumentError, "Receipt order hub is required" if hub.blank?
        raise ArgumentError, "Receipt order received date is required" if received_date.blank?
        raise ArgumentError, "Receipt order has no lines" if receipt_order_lines.empty?

        invalid_line = receipt_order_lines.detect { |line| line.commodity_id.blank? || line.unit_id.blank? || line.quantity.to_f <= 0 }
        raise ArgumentError, "Receipt order contains incomplete lines" if invalid_line.present?
      end
    end
  end
end
