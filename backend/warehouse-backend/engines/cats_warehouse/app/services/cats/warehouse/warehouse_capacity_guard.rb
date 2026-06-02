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

          # Try standard UOM conversion graph first
          begin
            return UomConversionResolver.convert!(
              quantity,
              from_unit_id: from_unit_id,
              to_unit_id: mt_unit_id,
              commodity_id: commodity_id
            )
          rescue ArgumentError
            # No direct conversion path — try commodity-level weight
          end

          # For ITEM-type units (pcs, bag), use commodity's weight_per_unit_kg
          if from_unit&.unit_type == Cats::Core::UnitOfMeasure::ITEM
            commodity = Cats::Core::Commodity.find_by(id: commodity_id)
            weight_per_unit = commodity&.weight_per_unit_kg.to_f
            weight_per_unit = 1.0 if weight_per_unit <= 0

            qty_kg = quantity.to_f * weight_per_unit
            kg_unit = Cats::Core::UnitOfMeasure.find_by("LOWER(abbreviation) = ?", "kg")
            if kg_unit
              return UomConversionResolver.convert!(
                qty_kg,
                from_unit_id: kg_unit.id,
                to_unit_id: mt_unit_id,
                commodity_id: nil
              )
            end
          end

          # For VOLUME-type units (l), use commodity's volume_per_metric_ton
          if from_unit&.unit_type == Cats::Core::UnitOfMeasure::VOLUME
            commodity = Cats::Core::Commodity.find_by(id: commodity_id)
            vpm = commodity&.volume_per_metric_ton.to_f
            vpm = CommodityDensityResolver.default_density if vpm <= 0

            # 1 L = 0.001 m³; 1 MT = vpm m³
            qty_m3 = quantity.to_f * 0.001
            return (qty_m3 / vpm).round(3)
          end

          raise ArgumentError,
                "No unit conversion from unit #{from_unit_id} (#{from_unit&.abbreviation}) " \
                "to MT for this commodity"
        end
      end
    end
  end
end
