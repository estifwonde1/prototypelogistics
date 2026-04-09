module Cats
  module Warehouse
    class UomConversionResolver
      def self.multiplier(from_unit_id:, to_unit_id:, commodity_id: nil)
        return 1.0 if from_unit_id == to_unit_id

        # 1. Try commodity-specific conversion
        conversion = UomConversion.active_only.find_by(
          commodity_id: commodity_id,
          from_unit_id: from_unit_id,
          to_unit_id: to_unit_id
        )

        return conversion.multiplier.to_f if conversion

        # 2. Try global conversion
        conversion = UomConversion.active_only.find_by(
          commodity_id: nil,
          from_unit_id: from_unit_id,
          to_unit_id: to_unit_id
        )

        return conversion.multiplier.to_f if conversion

        # 3. Try inverse commodity-specific conversion
        inverse = UomConversion.active_only.find_by(
          commodity_id: commodity_id,
          from_unit_id: to_unit_id,
          to_unit_id: from_unit_id
        )

        return 1.0 / inverse.multiplier.to_f if inverse

        # 4. Try inverse global conversion
        inverse = UomConversion.active_only.find_by(
          commodity_id: nil,
          from_unit_id: to_unit_id,
          to_unit_id: from_unit_id
        )

        return 1.0 / inverse.multiplier.to_f if inverse

        # Fallback to 1.0 if no conversion defined
        1.0
      end

      def self.convert(quantity, from_unit_id:, to_unit_id:, commodity_id: nil)
        multi = multiplier(
          from_unit_id: from_unit_id,
          to_unit_id: to_unit_id,
          commodity_id: commodity_id
        )
        (quantity.to_f * multi).round(3)
      end
    end
  end
end
