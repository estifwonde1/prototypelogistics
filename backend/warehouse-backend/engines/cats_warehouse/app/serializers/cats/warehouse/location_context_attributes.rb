module Cats
  module Warehouse
    module LocationContextAttributes
      extend ActiveSupport::Concern

      included do
        attributes :region_id, :region_name, :zone_id, :subcity_name, :woreda_id, :woreda_name, :kebele_id, :kebele_name
      end

      def region_id
        region_ancestor&.id
      end

      def region_name
        region_ancestor&.name
      end

      def zone_id
        zone_ancestor&.id
      end

      def subcity_name
        zone_ancestor&.name
      end

      def woreda_id
        woreda_ancestor&.id
      end

      def woreda_name
        woreda_ancestor&.name
      end

      def kebele_id
        kebele_ancestor&.id
      end

      def kebele_name
        kebele_ancestor&.name
      end

      private

      def location_record
        object.location
      end

      def location_ancestors
        location = location_record
        return [] unless location&.respond_to?(:path)

        Array(location.path)
      end

      def zone_ancestor
        location_ancestors.find { |entry| location_type_matches?(entry, :ZONE, "zone") }
      end

      def region_ancestor
        location_ancestors.find { |entry| location_type_matches?(entry, :REGION, "region") }
      end

      def woreda_ancestor
        location_ancestors.find { |entry| location_type_matches?(entry, :WOREDA, "woreda") }
      end

      def kebele_ancestor
        return location_record if location_type_matches?(location_record, :KEBELE, "Kebele")

        location_ancestors.find { |entry| location_type_matches?(entry, :KEBELE, "Kebele") }
      end

      def location_type_matches?(location, constant_name, fallback)
        return false unless location

        expected = if Cats::Core::Location.const_defined?(constant_name)
                     Cats::Core::Location.const_get(constant_name)
                   else
                     fallback
                   end
        location.location_type.to_s == expected.to_s
      end
    end
  end
end
