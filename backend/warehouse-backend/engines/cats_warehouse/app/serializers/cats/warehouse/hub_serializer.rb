module Cats
  module Warehouse
    class HubSerializer < ApplicationSerializer
      attributes :id, :code, :name, :hub_type, :status, :description, :location_name,
                 :subcity_name, :woreda_name, :kebele_name, :geo_id, :created_at, :updated_at, :hub_contacts

      has_one :hub_capacity, serializer: HubCapacitySerializer
      has_one :hub_access, serializer: HubAccessSerializer
      has_one :geo, serializer: GeoSerializer

      def hub_contacts
        object.live_hub_contact_payload
      end

      def location_name
        object.location&.name
      end

      def subcity_name
        zone_ancestor&.name
      end

      def woreda_name
        woreda_ancestor&.name
      end

      def kebele_name
        kebele_ancestor&.name
      end

      private

      def location_ancestors
        location = object.location
        return [] unless location&.respond_to?(:path)

        Array(location.path)
      end

      def zone_ancestor
        location_ancestors.find { |location| location_type_matches?(location, :ZONE, "zone") }
      end

      def woreda_ancestor
        location_ancestors.find { |location| location_type_matches?(location, :WOREDA, "woreda") }
      end

      def kebele_ancestor
        return object.location if location_type_matches?(object.location, :KEBELE, "kebele")

        location_ancestors.find { |location| location_type_matches?(location, :KEBELE, "kebele") }
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
