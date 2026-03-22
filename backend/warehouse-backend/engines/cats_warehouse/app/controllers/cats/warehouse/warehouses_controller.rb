module Cats
  module Warehouse
    class WarehousesController < BaseController
      def index
        authorize Warehouse
        render_resource(scoped_warehouses.order(:id), each_serializer: WarehouseSerializer)
      end

      def show
        warehouse = scoped_warehouses.find(params[:id])
        authorize warehouse
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def create
        authorize Warehouse
        warehouse = Warehouse.new(warehouse_params)
        attach_rental_agreement!(warehouse)
        warehouse.save!
        render_resource(warehouse, status: :created, serializer: WarehouseSerializer)
      end

      def update
        warehouse = scoped_warehouses.find(params[:id])
        authorize warehouse
        warehouse.assign_attributes(warehouse_params)
        attach_rental_agreement!(warehouse)
        warehouse.rental_agreement_document.purge if warehouse.ownership_type_self_owned? && warehouse.rental_agreement_document.attached?
        warehouse.save!
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def destroy
        warehouse = scoped_warehouses.find(params[:id])
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
          :managed_under,
          :ownership_type,
          :status,
          :description,
          :rental_agreement_document,
          :rental_agreement_document_signed_id
        )
      end

      def attach_rental_agreement!(warehouse)
        return unless warehouse_params[:rental_agreement_document].present? || warehouse_params[:rental_agreement_document_signed_id].present?

        attachment = warehouse_params[:rental_agreement_document] || warehouse_params[:rental_agreement_document_signed_id]
        warehouse.rental_agreement_document.attach(attachment)
      end

      def scoped_warehouses
        return Warehouse.all if admin_user?

        if hub_manager?
          hub_warehouse_ids = warehouses_for_hubs(assigned_hub_ids)
          return Warehouse.where(id: hub_warehouse_ids)
        end

        if warehouse_manager?
          return Warehouse.where(id: assigned_warehouse_ids)
        end

        Warehouse.none
      end
    end
  end
end
