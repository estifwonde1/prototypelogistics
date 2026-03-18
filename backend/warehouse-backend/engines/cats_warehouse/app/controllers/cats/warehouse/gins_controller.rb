module Cats
  module Warehouse
    class GinsController < BaseController
      def index
        authorize Gin
        render_resource(scoped_gins.includes(:gin_items).order(created_at: :desc), each_serializer: GinSerializer)
      end

      def show
        gin = scoped_gins.includes(:gin_items).find(params[:id])
        authorize gin
        render_resource(gin, serializer: GinSerializer)
      end

      def create
        payload = gin_params

        authorize Gin
        gin = GinCreator.new(
          warehouse: Warehouse.find(payload[:warehouse_id]),
          issued_on: payload[:issued_on],
          issued_by: Cats::Core::User.find(payload[:issued_by_id]),
          items: payload[:items],
          destination: resolve_destination(payload[:destination_type], payload[:destination_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_resource(gin, status: :created, serializer: GinSerializer)
      end

      def confirm
        gin = scoped_gins.find(params[:id])
        authorize gin, :confirm?
        approved_by = params[:approved_by_id].present? ? Cats::Core::User.find(params[:approved_by_id]) : nil

        GinConfirmer.new(gin: gin, approved_by: approved_by).call
        render_resource(gin, serializer: GinSerializer)
      end

      private

      def gin_params
        params.require(:payload).permit(
          :warehouse_id,
          :issued_on,
          :issued_by_id,
          :reference_no,
          :status,
          :destination_type,
          :destination_id,
          items: [
            :commodity_id,
            :quantity,
            :unit_id,
            :store_id,
            :stack_id
          ]
        )
      end

      def resolve_destination(destination_type, destination_id)
        return nil if destination_type.blank? || destination_id.blank?

        destination_type.constantize.find(destination_id)
      end

      def scoped_gins
        return Gin.all if admin_user?

        if hub_manager?
          hub_warehouse_ids = warehouses_for_hubs(assigned_hub_ids)
          return Gin.where(warehouse_id: hub_warehouse_ids)
        end

        if warehouse_manager?
          return Gin.where(warehouse_id: assigned_warehouse_ids)
        end

        if storekeeper?
          store_ids = assigned_store_ids
          return Gin.joins(:gin_items).where(cats_warehouse_gin_items: { store_id: store_ids }).distinct
        end

        Gin.none
      end
    end
  end
end
