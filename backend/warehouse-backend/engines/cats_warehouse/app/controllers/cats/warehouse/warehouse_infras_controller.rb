module Cats
  module Warehouse
    class WarehouseInfrasController < BaseController
      def show
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_infra, serializer: WarehouseInfraSerializer)
      end

      def create
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        infra = WarehouseInfra.create!(warehouse: warehouse, **infra_params)
        render_resource(infra, status: :created, serializer: WarehouseInfraSerializer)
      end

      def update
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
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
    end
  end
end
