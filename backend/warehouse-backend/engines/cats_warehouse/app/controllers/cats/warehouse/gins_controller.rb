module Cats
  module Warehouse
    class GinsController < BaseController
      def create
        payload = gin_params

        gin = GinCreator.new(
          warehouse: Warehouse.find(payload[:warehouse_id]),
          issued_on: payload[:issued_on],
          issued_by: Cats::Core::User.find(payload[:issued_by_id]),
          items: payload[:items],
          destination: resolve_destination(payload[:destination_type], payload[:destination_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_success({ id: gin.id }, status: :created)
      end

      def confirm
        gin = Gin.find(params[:id])
        approved_by = params[:approved_by_id].present? ? Cats::Core::User.find(params[:approved_by_id]) : nil

        GinConfirmer.new(gin: gin, approved_by: approved_by).call
        render_success({ id: gin.id, status: gin.status })
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
    end
  end
end
