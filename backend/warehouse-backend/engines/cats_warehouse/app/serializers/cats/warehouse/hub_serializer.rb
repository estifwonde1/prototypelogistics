module Cats
  module Warehouse
    class HubSerializer < ApplicationSerializer
      attributes :id, :code, :name, :hub_type, :status, :description, :location_id, :geo_id, :created_at, :updated_at

      has_one :hub_capacity, serializer: HubCapacitySerializer
      has_one :hub_access, serializer: HubAccessSerializer
      has_one :hub_infra, serializer: HubInfraSerializer
      has_one :hub_contacts, serializer: HubContactsSerializer
      has_one :geo, serializer: GeoSerializer
    end
  end
end
