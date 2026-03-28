module Cats
  module Warehouse
    class WarehouseCapacitySerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :total_area_sqm, :total_storage_capacity_mt, :usable_storage_capacity_mt,
                 :length_m, :width_m, :height_m, :no_of_stores, :construction_year, :created_at, :updated_at
    end
  end
end
