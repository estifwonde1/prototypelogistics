module Cats
  module Warehouse
    class ReceiptOrderLine < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_order_lines"

      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :packaging_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :destination_hub, class_name: "Cats::Warehouse::Hub", optional: true, foreign_key: :destination_hub_id
      belongs_to :destination_warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true, foreign_key: :destination_warehouse_id
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :nullify
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :nullify

      validates :quantity, presence: true, numericality: { greater_than: 0 }
      validates :line_reference_no, presence: true
      validate :line_reference_no_unique_across_source_details

      before_validation :assign_line_reference_no_if_blank

      # Build attrs for create/update from API payload; omits notes if DB not migrated yet.
      def self.attributes_from_line_payload(raw_item)
        h = raw_item.respond_to?(:to_unsafe_h) ? raw_item.to_unsafe_h : raw_item.to_h
        item = h.with_indifferent_access
        attrs = {
          commodity_id: item[:commodity_id],
          quantity: item[:quantity],
          unit_id: item[:unit_id]
        }
        cols = column_names
        if cols.include?("notes")
          attrs[:notes] = item[:notes].presence
        end
        if cols.include?("packaging_unit_id")
          attrs[:packaging_unit_id] = item[:packaging_unit_id].presence
        end
        if cols.include?("packaging_size")
          attrs[:packaging_size] = parse_optional_line_decimal(item[:packaging_size])
        end
        if cols.include?("line_reference_no")
          attrs[:line_reference_no] = item[:line_reference_no].presence
        end
        if cols.include?("destination_hub_id")
          attrs[:destination_hub_id] = item[:destination_hub_id].presence
        end
        if cols.include?("destination_warehouse_id")
          attrs[:destination_warehouse_id] = item[:destination_warehouse_id].presence
        end
        attrs
      end

      def self.parse_optional_line_decimal(value)
        return nil if value.blank?

        BigDecimal(value.to_s)
      rescue ArgumentError
        nil
      end

      private

      def assign_line_reference_no_if_blank
        self.line_reference_no = SourceDetailReference.generate_unique if line_reference_no.blank?
      end

      def line_reference_no_unique_across_source_details
        return if line_reference_no.blank?
        return unless SourceDetailReference.taken?(line_reference_no, exclude_record: self)

        errors.add(:line_reference_no, "is already assigned to another source detail")
      end
    end
  end
end
