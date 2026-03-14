module Cats
  module Warehouse
    class WarehouseSerializer < ApplicationSerializer
      attributes :id, :code, :name, :warehouse_type, :status, :description, :location_id, :hub_id, :geo_id, :created_at, :updated_at
    end
  end
end
