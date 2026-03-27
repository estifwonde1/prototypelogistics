module Cats
  module Warehouse
    class WarehouseSerializer < ApplicationSerializer
      attributes :id, :code, :name, :warehouse_type, :status, :description, :location_id, :location_name,
                 :subcity_name, :woreda_name, :hub_id, :hub_name, :geo_id, :managed_under, :ownership_type,
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
        parent_zone&.name
      end

      def woreda_name
        object.location&.name
      end

      def hub_name
        object.hub&.name
      end

      private

      def parent_zone
        object.location&.respond_to?(:parent) ? object.location.parent : nil
      end
    end
  end
end
