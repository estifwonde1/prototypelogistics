module Cats
  module Warehouse
    class WarehouseInfrasController < BaseController
      def show
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_infra, serializer: WarehouseInfraSerializer)
      end

      def create
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        infra = WarehouseInfra.create!(warehouse: warehouse, **infra_params)
        render_resource(infra, status: :created, serializer: WarehouseInfraSerializer)
      end

      def update
        warehouse = scoped_warehouses.find(params[:warehouse_id])
        authorize warehouse
        infra = warehouse.warehouse_infra || WarehouseInfra.new(warehouse: warehouse)
        infra.update!(infra_params)
        render_resource(infra, serializer: WarehouseInfraSerializer)
      end

      private

      def infra_params
        params.require(:payload).permit(
          :floor_type,
          :roof_type,
          :has_fumigation_facility,
          :has_fire_extinguisher,
          :has_security_guard
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
