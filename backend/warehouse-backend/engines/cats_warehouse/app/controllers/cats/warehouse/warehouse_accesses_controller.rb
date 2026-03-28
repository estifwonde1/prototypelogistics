module Cats
  module Warehouse
    class WarehouseAccessesController < BaseController
      def show
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        render_resource(warehouse.warehouse_access, serializer: WarehouseAccessSerializer)
      end

      def create
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
        authorize warehouse
        access = WarehouseAccess.create!(warehouse: warehouse, **access_params)
        render_resource(access, status: :created, serializer: WarehouseAccessSerializer)
      end

      def update
        warehouse = policy_scope(Warehouse).find(params[:warehouse_id])
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
          :loading_dock_type,
          :access_road_type,
          :nearest_town,
          :distance_from_town_km
        )
      end
    end
  end
end
