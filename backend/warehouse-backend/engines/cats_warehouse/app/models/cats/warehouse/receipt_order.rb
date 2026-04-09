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
      has_many :inspections, class_name: "Cats::Warehouse::Inspection", dependent: :nullify
      has_many :grns, class_name: "Cats::Warehouse::Grn", dependent: :nullify
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :destroy
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :destroy
      has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent", dependent: :destroy

      validates :reference_no, uniqueness: true, allow_blank: true
      validates :created_by, presence: true

      before_validation :derive_hub_from_destination_warehouse

      def ensure_confirmable!
        super
        derive_hub_from_destination_warehouse

        if warehouse.blank? && hub.blank?
          raise ArgumentError, "Receipt order requires a destination hub or warehouse"
        end

        if warehouse.present?
          if warehouse.hub.present?
            raise ArgumentError,
                  "The destination warehouse is not linked to a hub. Link the warehouse to a hub in setup, or choose another warehouse." if hub.blank?

            if hub_id.present? && warehouse.hub_id.present? && warehouse.hub_id != hub_id
              raise ArgumentError, "Receipt order hub does not match the destination warehouse"
            end
          end
          # Stand-alone warehouse (no hub on the warehouse): confirmation allowed without order.hub
        end
        # Hub-only orders (warehouse blank, hub set): allowed

        raise ArgumentError, "Receipt order received date is required" if received_date.blank?
        raise ArgumentError, "Receipt order has no lines" if receipt_order_lines.empty?

        invalid_line = receipt_order_lines.detect { |line| line.commodity_id.blank? || line.unit_id.blank? || line.quantity.to_f <= 0 }
        raise ArgumentError, "Receipt order contains incomplete lines" if invalid_line.present?
      end

      private

      # When only a destination warehouse is set, copy its hub onto the receipt order.
      def derive_hub_from_destination_warehouse
        return if hub_id.present?
        return if warehouse.blank?

        wh_hub = warehouse.hub
        self.hub = wh_hub if wh_hub.present?
      end
    end
  end
end
