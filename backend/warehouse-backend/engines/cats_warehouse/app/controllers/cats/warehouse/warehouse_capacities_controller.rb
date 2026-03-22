module Cats
  module Warehouse
    class WarehouseCapacitiesController < BaseController
      def show
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_capacity, serializer: WarehouseCapacitySerializer)
      end

      def create
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        capacity = WarehouseCapacity.create!(warehouse: warehouse, **capacity_params)
        render_resource(capacity, status: :created, serializer: WarehouseCapacitySerializer)
      end

      def update
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        capacity = warehouse.warehouse_capacity || WarehouseCapacity.new(warehouse: warehouse)
        capacity.update!(capacity_params)
        render_resource(capacity, serializer: WarehouseCapacitySerializer)
      end

      private

      def capacity_params
        params.require(:payload).permit(
          :total_area_sqm,
          :total_storage_capacity_mt,
          :usable_storage_capacity_mt,
          :no_of_stores,
          :construction_year
        )
      end

      def scoped_warehouses
        return Warehouse.all if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        if current_user&.has_role?("Hub Manager")
          hub_ids = UserAssignment.where(user_id: current_user.id, role_name: "Hub Manager").pluck(:hub_id).compact
          return Warehouse.where(hub_id: hub_ids)
        end

        if current_user&.has_role?("Warehouse Manager")
          warehouse_ids = UserAssignment.where(user_id: current_user.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
          return Warehouse.where(id: warehouse_ids)
        end

        Warehouse.none
      end
    end
  end
end
