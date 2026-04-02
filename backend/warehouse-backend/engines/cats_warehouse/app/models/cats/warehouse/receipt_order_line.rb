module Cats
  module Warehouse
    class ReceiptOrderLine < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_order_lines"

      belongs_to :receipt_order, class_name: "Cats::Warehouse::ReceiptOrder"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :nullify
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :nullify

      validates :quantity, presence: true, numericality: { greater_than: 0 }

      # Build attrs for create/update from API payload; omits unit_price/notes if DB not migrated yet.
      def self.attributes_from_line_payload(raw_item)
        h = raw_item.respond_to?(:to_unsafe_h) ? raw_item.to_unsafe_h : raw_item.to_h
        item = h.with_indifferent_access
        attrs = {
          commodity_id: item[:commodity_id],
          quantity: item[:quantity],
          unit_id: item[:unit_id]
        }
        cols = column_names
        if cols.include?("unit_price")
          attrs[:unit_price] = parse_optional_line_decimal(item[:unit_price])
        end
        if cols.include?("notes")
          attrs[:notes] = item[:notes].presence
        end
        attrs
      end

      def self.parse_optional_line_decimal(value)
        return nil if value.blank?

        BigDecimal(value.to_s)
      rescue ArgumentError
        nil
      end
    end
  end
end
