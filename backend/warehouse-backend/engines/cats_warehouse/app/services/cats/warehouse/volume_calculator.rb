# frozen_string_literal: true

module Cats
  module Warehouse
    # Calculates the physical volume (m³) that a given quantity of a commodity
    # will occupy, using the commodity's volume_per_metric_ton density factor.
    #
    # volume_per_metric_ton is stored on cats_core_commodities as m³ per metric
    # tonne (MT). When missing, uses planning reference density (1.25 m³/MT).
    class VolumeCalculator
      def self.effective_volume_per_metric_ton(commodity)
        CommodityDensityResolver.effective_for_commodity(commodity)
      end

      # @param commodity [Cats::Core::Commodity]
      # @param base_quantity [Numeric] quantity in base unit (MT)
      # @return [Float, nil] volume in m³, or nil when base_quantity <= 0
      def self.call(commodity:, base_quantity:)
        qty = base_quantity.to_f
        return nil if qty <= 0

        vpm = effective_volume_per_metric_ton(commodity)
        (qty * vpm).round(6)
      end
    end
  end
end
