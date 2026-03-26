module Cats
  module Warehouse
    class InspectionItem < ApplicationRecord
      self.table_name = "cats_warehouse_inspection_items"

      belongs_to :inspection, class_name: "Cats::Warehouse::Inspection"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"

      validates :quantity_received, presence: true
      validates :quantity_received, :quantity_damaged, :quantity_lost, numericality: { greater_than_or_equal_to: 0 }
      validate :losses_cannot_exceed_received

      private

      def losses_cannot_exceed_received
        return unless quantity_received.present?
        return if quantity_damaged.to_f + quantity_lost.to_f <= quantity_received.to_f

        errors.add(:base, "Damaged and lost quantities cannot exceed the quantity received")
      end
    end
  end
end
