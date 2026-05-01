module Cats
  module Warehouse
    class StoreSerializer < ApplicationSerializer
      attributes :id, :code, :name, :length, :width, :height, :total_space, :usable_space, :available_space,
                 :temporary, :has_gangway, :gangway_length, :gangway_width, :gangway_corner_dist,
                 :warehouse_id, :created_at, :updated_at, :assigned_storekeepers

      def assigned_storekeepers
        # Get storekeepers with warehouse-level assignment for this store's warehouse
        warehouse_storekeepers = UserAssignment
          .where(role_name: "Storekeeper", warehouse_id: object.warehouse_id)
          .includes(:user)
          .map { |a| { id: a.user.id, name: "#{a.user.first_name} #{a.user.last_name}" } }
        
        # Get storekeepers with store-level assignment for this specific store
        store_storekeepers = UserAssignment
          .where(role_name: "Storekeeper", store_id: object.id)
          .includes(:user)
          .map { |a| { id: a.user.id, name: "#{a.user.first_name} #{a.user.last_name}" } }
        
        # Merge both (warehouse-level storekeepers appear on all stores)
        (warehouse_storekeepers + store_storekeepers).uniq { |s| s[:id] }
      end
    end
  end
end
