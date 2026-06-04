module Cats
  module Warehouse
    class WarehouseSerializer < ApplicationSerializer
      include Cats::Warehouse::LocationContextAttributes

      attributes :id, :code, :name, :warehouse_type, :status, :operational, :operational_blockers,
                 :description, :location_id, :location_name,
                 :kebele, :hub_id, :hub_name, :geo_id, :managed_under, :ownership_type,
                 :rental_agreement_document, :created_at, :updated_at, :assigned_manager,
                 :warehouse_contacts

      has_one :warehouse_capacity, serializer: WarehouseCapacitySerializer
      has_one :warehouse_access, serializer: WarehouseAccessSerializer
      has_one :warehouse_infra, serializer: WarehouseInfraSerializer
      has_one :geo, serializer: GeoSerializer

      def warehouse_contacts
        object.live_warehouse_contact_payload
      end

      def operational
        object.operational?
      end

      def operational_blockers
        object.operational_blockers
      end

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

      def hub_name
        object.hub&.name
      end

      def assigned_manager
        managers = object.user_assignments
                         .select { |assignment| assignment.role_name == "Warehouse Manager" }
                         .map { |assignment| "#{assignment.user.first_name} #{assignment.user.last_name}" }
                         .uniq

        return managers.join(", ") if managers.any?

        nil
      end
    end
  end
end
