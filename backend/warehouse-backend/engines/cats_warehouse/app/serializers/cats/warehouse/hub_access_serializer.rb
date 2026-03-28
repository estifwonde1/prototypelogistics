module Cats
  module Warehouse
    class HubAccessSerializer < ApplicationSerializer
      attributes :id, :hub_id, :has_loading_dock, :number_of_loading_docks, :loading_dock_type,
                 :access_road_type, :nearest_town, :distance_from_town_km, :has_weighbridge, :created_at, :updated_at
    end
  end
end
