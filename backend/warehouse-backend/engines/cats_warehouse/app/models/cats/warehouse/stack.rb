module Cats
  module Warehouse
    class Stack < ApplicationRecord
      self.table_name = "cats_warehouse_stacks"

      belongs_to :store, class_name: "Cats::Warehouse::Store"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      has_many :outgoing_stack_transactions,
               class_name: "Cats::Warehouse::StackTransaction",
               foreign_key: :source_id,
               dependent: :nullify
      has_many :incoming_stack_transactions,
               class_name: "Cats::Warehouse::StackTransaction",
               foreign_key: :destination_id,
               dependent: :nullify
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy

      validates :length, :width, :height, presence: true
      validates :length, :width, :height, numericality: { greater_than: 0 }
      validates :quantity, numericality: { greater_than_or_equal_to: 0 }
      validate :fits_inside_store

      def footprint_area
        length.to_f * width.to_f
      end

      def volume
        footprint_area * height.to_f
      end

      private

      def fits_inside_store
        return unless store.present?

        if length.to_f > store.length.to_f || width.to_f > store.width.to_f || height.to_f > store.height.to_f
          errors.add(:base, "Stack dimensions cannot exceed the store dimensions")
        end

        if footprint_area > store.usable_floor_area
          errors.add(:base, "Stack footprint cannot exceed the store usable floor area")
        end

        return unless volume > store.usable_space.to_f

        errors.add(:base, "Stack volume cannot exceed the store usable capacity")
      end
    end
  end
end
