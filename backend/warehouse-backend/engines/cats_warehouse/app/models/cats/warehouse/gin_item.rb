module Cats
  module Warehouse
    class GinItem < ApplicationRecord
      self.table_name = "cats_warehouse_gin_items"

      belongs_to :gin, class_name: "Cats::Warehouse::Gin"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack", optional: true

      validates :quantity, presence: true
      validate :store_and_stack_match_header

      private

      def store_and_stack_match_header
        return unless gin && (store || stack)

        if store && store.warehouse_id != gin.warehouse_id
          errors.add(:store_id, "must belong to the GIN warehouse")
        end

        return unless stack

        errors.add(:stack_id, "must belong to the GIN warehouse") if stack.store&.warehouse_id != gin.warehouse_id
        errors.add(:stack_id, "must belong to the selected store") if store && stack.store_id != store_id
      end
    end
  end
end
