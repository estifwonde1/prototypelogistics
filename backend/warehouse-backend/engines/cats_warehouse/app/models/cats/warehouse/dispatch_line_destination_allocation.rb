# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchLineDestinationAllocation < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_line_destination_allocations"

      belongs_to :dispatch_order_line, class_name: "Cats::Warehouse::DispatchOrderLine"
      belongs_to :destination_location, class_name: "Cats::Core::Location"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      validates :quantity, presence: true, numericality: { greater_than: 0 }

      before_validation :normalize_quantities_and_type

      private

      def normalize_quantities_and_type
        return if dispatch_order_line.blank? || unit_id.blank?

        commodity_id = dispatch_order_line.commodity_id
        base_unit_id = dispatch_order_line.commodity&.unit_of_measure_id || unit_id
        self.base_unit_id = base_unit_id
        self.base_quantity = UomConversionResolver.convert!(
          quantity,
          from_unit_id: unit_id,
          to_unit_id: base_unit_id,
          commodity_id: commodity_id
        )
        self.destination_location_type = destination_location&.location_type if destination_location.present?
      end
    end
  end
end
