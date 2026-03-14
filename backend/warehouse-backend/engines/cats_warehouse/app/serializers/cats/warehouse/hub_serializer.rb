module Cats
  module Warehouse
    class HubSerializer < ApplicationSerializer
      attributes :id, :code, :name, :hub_type, :status, :description, :location_id, :geo_id, :created_at, :updated_at
    end
  end
end
