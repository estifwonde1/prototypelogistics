module Cats
  module Warehouse
    class StoreSerializer < ApplicationSerializer
      attributes :id, :code, :name, :length, :width, :height, :usable_space, :available_space,
                 :temporary, :has_gangway, :gangway_length, :gangway_width, :gangway_corner_dist,
                 :warehouse_id, :created_at, :updated_at
    end
  end
end
