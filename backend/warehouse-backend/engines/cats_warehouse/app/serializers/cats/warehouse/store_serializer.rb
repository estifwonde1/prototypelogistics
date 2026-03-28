module Cats
  module Warehouse
    class StoreSerializer < ApplicationSerializer
      attributes :id, :code, :name, :length, :width, :height, :usable_space, :available_space,
                 :total_area_m2, :usable_area_m2, :temporary, :has_gangway, :gangway_length, :gangway_width, :gangway_corner_dist,
                 :warehouse_id, :warehouse_name, :warehouse_code, :created_at, :updated_at

      def total_area_m2
        object.available_space
      end

      def usable_area_m2
        object.usable_space
      end

      def warehouse_name
        object.warehouse&.name
      end

      def warehouse_code
        object.warehouse&.code
      end
    end
  end
end
