module Cats
  module Warehouse
    class WarehousesController < BaseController
      def index
        warehouses = Warehouse.order(:id)
        render_success({ warehouses: warehouses })
      end

      def show
        warehouse = Warehouse.find_by(id: params[:id])
        return render_error("Warehouse not found", status: :not_found) unless warehouse

        render_success({ warehouse: warehouse })
      end

      def create
        warehouse = Warehouse.new(warehouse_params)

        if warehouse.save
          render_success({ id: warehouse.id }, status: :created)
        else
          render_error("Failed to create warehouse", details: warehouse.errors.full_messages)
        end
      end

      def update
        warehouse = Warehouse.find_by(id: params[:id])
        return render_error("Warehouse not found", status: :not_found) unless warehouse

        if warehouse.update(warehouse_params)
          render_success({ id: warehouse.id })
        else
          render_error("Failed to update warehouse", details: warehouse.errors.full_messages)
        end
      end

      def destroy
        warehouse = Warehouse.find_by(id: params[:id])
        return render_error("Warehouse not found", status: :not_found) unless warehouse

        if warehouse.destroy
          render_success({ id: warehouse.id })
        else
          render_error("Failed to delete warehouse", details: warehouse.errors.full_messages)
        end
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
