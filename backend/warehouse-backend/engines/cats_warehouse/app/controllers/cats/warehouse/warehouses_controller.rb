module Cats
  module Warehouse
    class WarehousesController < BaseController
      def index
        authorize Warehouse
        render_resource(Warehouse.order(:id), each_serializer: WarehouseSerializer)
      end

      def show
        warehouse = Warehouse.find(params[:id])
        authorize warehouse
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def create
        authorize Warehouse
        warehouse = Warehouse.create!(warehouse_params)
        render_resource(warehouse, status: :created, serializer: WarehouseSerializer)
      end

      def update
        warehouse = Warehouse.find(params[:id])
        authorize warehouse
        warehouse.update!(warehouse_params)
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def destroy
        warehouse = Warehouse.find(params[:id])
        authorize warehouse
        warehouse.destroy!
        render_success({ id: warehouse.id })
      end

      private

      def warehouse_params
        params.require(:payload).permit(
          :location_id,
          :hub_id,
          :geo_id,
          :code,
          :name,
          :warehouse_type,
          :status,
          :description
        )
      end
    end
  end
end
