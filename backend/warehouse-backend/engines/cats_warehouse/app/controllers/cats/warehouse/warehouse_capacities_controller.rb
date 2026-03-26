module Cats
  module Warehouse
    class WarehouseCapacitiesController < BaseController
      def show
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_capacity, serializer: WarehouseCapacitySerializer)
      end

      def create
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        capacity = WarehouseCapacity.create!(warehouse: warehouse, **capacity_params)
        render_resource(capacity, status: :created, serializer: WarehouseCapacitySerializer)
      end

      def update
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
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
    end
  end
end
