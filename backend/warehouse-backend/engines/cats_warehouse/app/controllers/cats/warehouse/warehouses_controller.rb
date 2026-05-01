module Cats
  module Warehouse
    class WarehousesController < BaseController
      def index
        authorize Warehouse
        warehouses = policy_scope(Warehouse)
                     .includes(:warehouse_capacity, :warehouse_access, :warehouse_infra, :warehouse_contacts, :location, :hub, :geo, user_assignments: :user)
                     .order(:id)
        render_resource(warehouses, each_serializer: WarehouseSerializer)
      end

      def show
        warehouse = policy_scope(Warehouse)
                    .includes(:warehouse_capacity, :warehouse_access, :warehouse_infra, :warehouse_contacts, :location, :hub, :geo, user_assignments: :user)
                    .find(params[:id])
        authorize warehouse
        render_resource(warehouse, serializer: WarehouseSerializer)
      end

      def create
        authorize Warehouse
        warehouse = build_warehouse_for_create

        attach_rental_document(warehouse)

        warehouse.save!
        render_resource(warehouse, status: :created, serializer: WarehouseSerializer)
      end

      def update
        warehouse = policy_scope(Warehouse).find(params[:id])
        authorize warehouse
        warehouse.assign_attributes(warehouse_params.except(:rental_agreement_document, :rental_agreement_document_signed_id))

        if warehouse.ownership_type_self_owned? && warehouse.rental_agreement_document.attached?
          warehouse.rental_agreement_document.purge
        else
          attach_rental_document(warehouse)
        end

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
        # Exclude file params from warehouse initialization
        params_for_init = warehouse_params.except(:rental_agreement_document, :rental_agreement_document_signed_id)
        
        if params_for_init[:hub_id].present?
          hub = policy_scope(Hub).find(params_for_init[:hub_id])
          Warehouse.new(params_for_init.except(:hub_id).merge(hub: hub))
        else
          raise Pundit::NotAuthorizedError, "Not authorized" unless current_access.admin?

          Warehouse.new(params_for_init)
        end
      end

      def attach_rental_document(warehouse)
        if warehouse_params[:rental_agreement_document].present?
          warehouse.rental_agreement_document.attach(warehouse_params[:rental_agreement_document])
        elsif warehouse_params[:rental_agreement_document_signed_id].present?
          warehouse.rental_agreement_document.attach(warehouse_params[:rental_agreement_document_signed_id])
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
          :rental_agreement_document_signed_id,
          :kebele
        )
      end

      def current_access
        @current_access ||= AccessContext.new(user: current_user)
      end

    end
  end
end
