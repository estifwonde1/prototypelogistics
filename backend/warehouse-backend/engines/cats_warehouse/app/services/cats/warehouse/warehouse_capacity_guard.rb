# frozen_string_literal: true

module Cats
  module Warehouse
    # Validates that an inbound assignment quantity fits within warehouse MT capacity.
    class WarehouseCapacityGuard
      EPSILON = 1e-6

      class << self
        def ensure_fits!(warehouse:, quantity:, quantity_unit_id:, commodity_id:, line_unit_id: nil)
          return unless warehouse.capacity_established?

          from_unit_id = quantity_unit_id.presence || line_unit_id
          if from_unit_id.blank?
            raise ArgumentError, "Unit is required to validate warehouse capacity"
          end

          qty_mt = quantity_in_metric_tons(
            quantity,
            from_unit_id: from_unit_id,
            commodity_id: commodity_id
          )

          usage = CapacityUsage.for_warehouse(warehouse)
          return if qty_mt <= usage.remaining_mt + EPSILON

          raise ArgumentError,
                "Insufficient warehouse capacity: #{qty_mt.round(2)} MT exceeds remaining " \
                "#{usage.remaining_mt.round(2)} MT at #{warehouse.name}"
        end

        private

        def quantity_in_metric_tons(quantity, from_unit_id:, commodity_id:)
          from_unit = Cats::Core::UnitOfMeasure.find_by(id: from_unit_id)
          return quantity.to_f if from_unit&.abbreviation.to_s.downcase == "mt"

          mt_unit_id = Cats::Core::UnitOfMeasure
            .where("LOWER(abbreviation) = ?", "mt")
            .order(:id)
            .pick(:id)
          return quantity.to_f if mt_unit_id.blank?
          return quantity.to_f if from_unit_id.to_i == mt_unit_id.to_i

          UomConversionResolver.convert!(
            quantity,
            from_unit_id: from_unit_id,
            to_unit_id: mt_unit_id,
            commodity_id: commodity_id
          )
        end
      end
    end
  end
end
