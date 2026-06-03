module Cats
  module Warehouse
    class StoreSerializer < ApplicationSerializer
      attributes :id, :code, :name, :length, :width, :height, :total_space,
                 :usable_space, :available_space,
                 :usable_volume_m3, :occupied_volume_m3, :available_volume_m3,
                 :allocated_capacity_mt,
                 :used_capacity_mt, :remaining_capacity_mt, :utilization_pct,
                 :temporary, :has_gangway, :gangway_length, :gangway_width, :gangway_corner_dist,
                 :warehouse_id, :created_at, :updated_at, :assigned_storekeepers,
                 :warehouse_usable_space_percentage, :warehouse_total_area_sqm,
                 :warehouse_usable_storage_capacity_mt, :warehouse_capacity_established

      def warehouse_usable_space_percentage
        object.warehouse&.warehouse_capacity&.usable_space_percentage || 75
      end

      def warehouse_total_area_sqm
        object.warehouse&.warehouse_capacity&.total_area_sqm
      end

      def warehouse_usable_storage_capacity_mt
        object.warehouse&.warehouse_capacity&.usable_storage_capacity_mt
      end

      def warehouse_capacity_established
        object.warehouse&.capacity_established? == true
      end

      def used_capacity_mt
        store_usage.used_mt
      end

      def remaining_capacity_mt
        store_usage.remaining_mt
      end

      def utilization_pct
        store_usage.utilization_pct
      end

      def assigned_storekeepers
        object.user_assignments.select { |a| a.role_name == "Storekeeper" }.map { |a| { id: a.user.id, name: "#{a.user.first_name} #{a.user.last_name}" } }
      end

      private

      def store_usage
        @store_usage ||= CapacityUsage.for_store(object)
      end
    end
  end
end
