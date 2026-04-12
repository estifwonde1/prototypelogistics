module Cats
  module Warehouse
    class WarehouseSerializer < ApplicationSerializer
      attributes :id, :code, :name, :warehouse_type, :status, :description, :location_id, :location_name,
                 :subcity_name, :woreda_name, :kebele_name, :kebele, :hub_id, :hub_name, :geo_id, :managed_under, :ownership_type,
                 :rental_agreement_document, :created_at, :updated_at

      has_one :warehouse_capacity, serializer: WarehouseCapacitySerializer
      has_one :warehouse_access, serializer: WarehouseAccessSerializer
      has_one :warehouse_infra, serializer: WarehouseInfraSerializer
      has_one :warehouse_contacts, serializer: WarehouseContactsSerializer
      has_one :geo, serializer: GeoSerializer

      def rental_agreement_document
        return unless object.rental_agreement_document.attached?

        blob = object.rental_agreement_document.blob
        {
          id: blob.id,
          filename: blob.filename.to_s,
          content_type: blob.content_type,
          byte_size: blob.byte_size,
          signed_id: blob.signed_id
        }
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

      def hub_name
        object.hub&.name
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
        return object.location if location_type_matches?(object.location, :KEBELE, "Kebele")

        location_ancestors.find { |location| location_type_matches?(location, :KEBELE, "Kebele") }
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
