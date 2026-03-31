module Cats
  module Warehouse
    class StackTransaction < ApplicationRecord
      self.table_name = "cats_warehouse_stack_transactions"

      belongs_to :source, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :destination, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true
      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :reference, polymorphic: true, optional: true

      validates :quantity, numericality: { greater_than: 0 }
      validates :base_quantity, numericality: { greater_than: 0 }, allow_nil: true
      validate :source_or_destination_present

      private

      def source_or_destination_present
        return if source_id.present? || destination_id.present?

        errors.add(:base, "Source or destination stack must be present")
      end
    end
  end
end
