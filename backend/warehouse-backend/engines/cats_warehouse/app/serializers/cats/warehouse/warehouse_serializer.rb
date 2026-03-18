module Cats
  module Warehouse
    class WarehouseSerializer < ApplicationSerializer
      attributes :id, :code, :name, :warehouse_type, :status, :description, :location_id, :hub_id, :geo_id, :created_at, :updated_at

      has_one :warehouse_capacity, serializer: WarehouseCapacitySerializer
      has_one :warehouse_access, serializer: WarehouseAccessSerializer
      has_one :warehouse_infra, serializer: WarehouseInfraSerializer
      has_one :warehouse_contacts, serializer: WarehouseContactsSerializer
      has_one :geo, serializer: GeoSerializer
    end
  end
end
