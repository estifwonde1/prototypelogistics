module Cats
  module Warehouse
    class WarehouseSerializer < ApplicationSerializer
      attributes :id, :code, :name, :warehouse_type, :status, :description, :location_id, :hub_id, :geo_id,
                 :managed_under, :ownership_type, :rental_agreement_document, :created_at, :updated_at

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
    end
  end
end
