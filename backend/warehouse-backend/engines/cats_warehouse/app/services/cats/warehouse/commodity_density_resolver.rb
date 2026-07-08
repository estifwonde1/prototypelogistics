# frozen_string_literal: true

module Cats
  module Warehouse
    # Resolves m³ per metric tonne for core commodities and catalog definitions.
    class CommodityDensityResolver
      def self.resolve(name: nil, explicit: nil)
        new(name: name, explicit: explicit).resolve
      end

      def self.effective_for_commodity(commodity)
        vpm = commodity&.volume_per_metric_ton.to_f
        return vpm if vpm.positive?

        default_density
      end

      def self.default_density
        CapacityCalculator::REFERENCE_M3_PER_MT
      end

      def initialize(name: nil, explicit: nil)
        @name = name
        @explicit = explicit
      end

      def resolve
        vpm = @explicit.to_f
        return vpm.round(4) if vpm.positive?

        from_definition = definition_density
        return from_definition if from_definition.positive?

        self.class.default_density
      end

      private

      def definition_density
        return 0.0 if @name.blank?

        definition = CommodityDefinition.where("LOWER(name) = ?", @name.to_s.strip.downcase).first
        definition&.volume_per_metric_ton.to_f
      end
    end
  end
end
