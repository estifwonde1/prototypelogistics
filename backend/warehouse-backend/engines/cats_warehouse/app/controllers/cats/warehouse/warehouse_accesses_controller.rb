module Cats
  module Warehouse
    class WarehouseAccessesController < BaseController
      def show
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_access, serializer: WarehouseAccessSerializer)
      end

      def create
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        access = WarehouseAccess.create!(warehouse: warehouse, **access_params)
        render_resource(access, status: :created, serializer: WarehouseAccessSerializer)
      end

      def update
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        access = warehouse.warehouse_access || WarehouseAccess.new(warehouse: warehouse)
        access.update!(access_params)
        render_resource(access, serializer: WarehouseAccessSerializer)
      end

      private

      def access_params
        params.require(:payload).permit(
          :has_loading_dock,
          :number_of_loading_docks,
          :access_road_type,
          :nearest_town,
          :distance_from_town_km
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
