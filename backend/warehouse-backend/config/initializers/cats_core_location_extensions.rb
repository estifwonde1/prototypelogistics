Rails.application.config.to_prepare do
  require "cats/core/location"

  module Cats
    module Core
      class Location
        unless const_defined?(:KEBELE)
          const_set(:KEBELE, "Kebele".freeze)
        end

        if const_defined?(:LOCATION_TYPES)
          types = (const_get(:LOCATION_TYPES) + [const_get(:KEBELE)]).uniq
          remove_const(:LOCATION_TYPES)
          const_set(:LOCATION_TYPES, types.freeze)
        end

        def self.kebele_enabled?
          const_defined?(:KEBELE) && const_defined?(:LOCATION_TYPES) && LOCATION_TYPES.include?(KEBELE)
        end

        module KebeleParentValidation
          def validate_location_parent
            parents = {
              REGION => [],
              ZONE => [REGION],
              WOREDA => [REGION, ZONE],
              KEBELE => [REGION, ZONE, WOREDA],
              FDP => [REGION, ZONE, WOREDA, KEBELE],
              HUB => [REGION, ZONE, WOREDA, FDP, KEBELE],
              WAREHOUSE => [REGION, ZONE, WOREDA, FDP, HUB, KEBELE]
            }

            return if location_type.nil? || location_type.empty?

            return if location_type == REGION && parent.nil?

            # Allow Kebele even though the inclusion validator was defined before we extended LOCATION_TYPES.
            errors.delete(:location_type) if location_type == KEBELE

            errors.add(:location, "parent cannot be empty") if location_type != REGION && parent.nil?
            return unless parent

            return if parents[location_type]&.include?(parent.location_type)

            errors.add(:location, "cannot have #{parent.location_type} as parent")
          end
        end

        prepend KebeleParentValidation
      end
    end
  end
end
