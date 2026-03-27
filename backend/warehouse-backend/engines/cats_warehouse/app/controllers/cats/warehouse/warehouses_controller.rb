module Cats
  module Warehouse
    class WarehousesController < BaseController
      def index
        authorize Warehouse
        render_resource(policy_scope(Warehouse).order(:id), each_serializer: WarehouseSerializer)
      end

      def show
        warehouse = policy_scope(Warehouse).find(params[:id])
        authorize warehouse
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def create
        authorize Warehouse
        warehouse = build_warehouse_for_create
        attach_rental_agreement!(warehouse)
        warehouse.save!
        render_resource(warehouse, status: :created, serializer: WarehouseSerializer)
      end

      def update
        warehouse = policy_scope(Warehouse).find(params[:id])
        authorize warehouse
        warehouse.assign_attributes(warehouse_params)
        attach_rental_agreement!(warehouse)
        warehouse.rental_agreement_document.purge if warehouse.ownership_type_self_owned? && warehouse.rental_agreement_document.attached?
        warehouse.save!
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def destroy
        warehouse = policy_scope(Warehouse).find(params[:id])
        authorize warehouse
        warehouse.destroy!
        render_success({ id: warehouse.id })
      end

      private

      def build_warehouse_for_create
        if warehouse_params[:hub_id].present?
          hub = policy_scope(Hub).find(warehouse_params[:hub_id])
          Warehouse.new(warehouse_params.except(:hub_id).merge(hub: hub))
        else
          raise Pundit::NotAuthorizedError, "Not authorized" unless current_access.admin?

          Warehouse.new(warehouse_params)
        end
      end

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

      def current_access
        @current_access ||= AccessContext.new(user: current_user)
      end

    end
  end
end
