module Cats
  module Warehouse
    class HubCapacitySerializer < ApplicationSerializer
      attributes :id, :hub_id, :total_area_sqm, :total_capacity_mt, :construction_year, :ownership_type, :created_at, :updated_at
    end
  end
end
