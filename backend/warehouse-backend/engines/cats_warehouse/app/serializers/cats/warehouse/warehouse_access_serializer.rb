module Cats
  module Warehouse
    class WarehouseAccessSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :has_loading_dock, :number_of_loading_docks, :loading_dock_type, :access_road_type,
                 :nearest_town, :distance_from_town_km, :created_at, :updated_at
    end
  end
end
