module Cats
  module Warehouse
    class InspectionItem < ApplicationRecord
      self.table_name = "cats_warehouse_inspection_items"

      belongs_to :inspection, class_name: "Cats::Warehouse::Inspection"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true
      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      validates :quantity_received, presence: true
      validates :quantity_received, :quantity_damaged, :quantity_lost, numericality: { greater_than_or_equal_to: 0 }
      validates :line_reference_no, presence: true
      validate :losses_cannot_exceed_received
      validate :line_reference_no_unique_across_source_details

      private

      def line_reference_no_unique_across_source_details
        return if line_reference_no.blank?
        return unless SourceDetailReference.taken?(line_reference_no, exclude_record: self)

        errors.add(:line_reference_no, "is already assigned to another source detail")
      end

      def losses_cannot_exceed_received
        return unless quantity_received.present?
        return if quantity_damaged.to_f + quantity_lost.to_f <= quantity_received.to_f

        errors.add(:base, "Damaged and lost quantities cannot exceed the quantity received")
      end
    end
  end
end
