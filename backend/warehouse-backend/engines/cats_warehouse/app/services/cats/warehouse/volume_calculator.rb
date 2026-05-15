# frozen_string_literal: true

module Cats
  module Warehouse
    # Calculates the physical volume (m³) that a given quantity of a commodity
    # will occupy, using the commodity's volume_per_metric_ton density factor.
    #
    # volume_per_metric_ton is stored on cats_core_commodities as m³ per metric
    # tonne (MT).  The item's quantity is already expressed in the commodity's
    # base unit (MT by convention in this system), so:
    #
    #   incoming_volume_m3 = base_quantity_delta * volume_per_metric_ton
    #
    # If volume_per_metric_ton is nil the commodity has no density data.
    # In that case #call returns nil and callers must decide whether to skip
    # the check or raise.
    #
    # Usage:
    #   result = VolumeCalculator.call(commodity: item.commodity,
    #                                  base_quantity: base_quantity_delta)
    #   # => Float (m³) or nil
    class VolumeCalculator
      # @param commodity [Cats::Core::Commodity]
      # @param base_quantity [Numeric]  quantity expressed in the commodity's
      #   base unit (MT).  May be negative for issues/adjustments.
      # @return [Float, nil]  volume in m³, or nil when density is unknown.
      def self.call(commodity:, base_quantity:)
        vpm = commodity&.volume_per_metric_ton.to_f
        return nil if vpm <= 0

        (base_quantity.to_f * vpm).round(6)
      end
    end
  end
end
