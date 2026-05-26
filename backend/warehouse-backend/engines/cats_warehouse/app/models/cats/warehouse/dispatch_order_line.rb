# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderLine < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_lines"

      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :packaging_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      has_many :source_allocations, class_name: "Cats::Warehouse::DispatchLineSourceAllocation", dependent: :destroy
      has_many :destination_allocations, class_name: "Cats::Warehouse::DispatchLineDestinationAllocation", dependent: :destroy
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :nullify
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :nullify

      validates :quantity, presence: true, numericality: { greater_than: 0 }

      before_validation :normalize_uom_and_packaging

      private

      def normalize_uom_and_packaging
        return if commodity_id.blank? || unit_id.blank?

        base_unit_id = commodity&.unit_of_measure_id || unit_id
        self.base_unit_id = base_unit_id
        self.base_quantity = UomConversionResolver.convert!(
          quantity,
          from_unit_id: unit_id,
          to_unit_id: base_unit_id,
          commodity_id: commodity_id
        )

        return unless packaging_size.to_f.positive?

        self.package_count = (base_quantity.to_f / packaging_size.to_f).ceil
      end
    end
  end
end
