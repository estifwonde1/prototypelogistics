module Cats
  module Warehouse
    class HubSerializer < ApplicationSerializer
      include Cats::Warehouse::LocationContextAttributes

      attributes :id, :code, :name, :hub_type, :status, :description, :location_id, :location_name,
                 :kebele, :geo_id, :created_at, :updated_at, :hub_contacts

      has_one :hub_capacity, serializer: HubCapacitySerializer
      has_one :hub_access, serializer: HubAccessSerializer
      has_one :geo, serializer: GeoSerializer

      def hub_contacts
        object.live_hub_contact_payload
      end

      def location_name
        object.location&.name
      end
    end
  end
end
