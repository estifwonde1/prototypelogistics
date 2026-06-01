module Cats
  module Warehouse
    class WarehouseCapacitySerializer < ApplicationSerializer
      attributes :id, :warehouse_id,
                 :length_m, :width_m, :height_m,
                 :total_area_sqm, :usable_volume_m3,
                 :total_storage_capacity_mt, :usable_storage_capacity_mt,
                 :usable_space_percentage, :capacity_established,
                 :used_capacity_mt, :remaining_capacity_mt, :utilization_pct,
                 :no_of_stores, :construction_year, :created_at, :updated_at

      def capacity_established
        object.capacity_established?
      end

      def used_capacity_mt
        usage.used_mt
      end

      def remaining_capacity_mt
        usage.remaining_mt
      end

      def utilization_pct
        usage.utilization_pct
      end

      def no_of_stores
        count = object.warehouse.stores.count
        count.positive? ? count : nil
      end

      private

      def usage
        @usage ||= CapacityUsage.for_warehouse(object.warehouse)
      end
    end
  end
end
