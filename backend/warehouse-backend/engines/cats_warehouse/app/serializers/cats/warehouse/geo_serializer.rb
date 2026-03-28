module Cats
  module Warehouse
    class GeoSerializer < ApplicationSerializer
      attributes :id, :latitude, :longitude, :altitude_m, :address
    end
  end
end
