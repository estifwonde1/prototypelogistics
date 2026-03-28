module Cats
  module Warehouse
    class GrnItem < ApplicationRecord
      self.table_name = "cats_warehouse_grn_items"

      belongs_to :grn, class_name: "Cats::Warehouse::Grn"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true

      validates :quantity, presence: true
      validate :store_and_stack_match_header

      private

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
