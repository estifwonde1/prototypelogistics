module Cats
  module Warehouse
    class GrnItem < ApplicationRecord
      self.table_name = "cats_warehouse_grn_items"

      belongs_to :grn, class_name: "Cats::Warehouse::Grn"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :inventory_lot, class_name: "Cats::Warehouse::InventoryLot", optional: true
      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true

      validates :quantity, presence: true
      validates :line_reference_no, presence: true
      validate :store_and_stack_match_header
      validate :line_reference_no_unique_across_source_details

      private

      def line_reference_no_unique_across_source_details
        return if line_reference_no.blank?
        return unless SourceDetailReference.taken?(line_reference_no, exclude_record: self)

        errors.add(:line_reference_no, "is already assigned to another source detail")
      end

      def store_and_stack_match_header
        return unless grn && (store || stack)

        if store && store.warehouse_id != grn.warehouse_id
          errors.add(:store_id, "must belong to the GRN warehouse")
        end

        return unless stack

        errors.add(:stack_id, "must belong to the GRN warehouse") if stack.store&.warehouse_id != grn.warehouse_id
        errors.add(:stack_id, "must belong to the selected store") if store && stack.store_id != store_id
      end
    end
  end
end
