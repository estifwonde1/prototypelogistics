module Cats
  module Warehouse
    class HubSerializer < ApplicationSerializer
      attributes :id, :code, :name, :hub_type, :status, :description, :location_id, :location_name,
                 :subcity_name, :woreda_name, :geo_id, :created_at, :updated_at, :hub_contacts

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
        parent_zone&.name
      end

      def woreda_name
        object.location&.name
      end

      private

      def parent_zone
        object.location&.respond_to?(:parent) ? object.location.parent : nil
      end
    end
  end
end
