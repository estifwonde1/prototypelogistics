module Cats
  module Warehouse
    class GinsController < BaseController
      def index
        authorize Gin
        render_resource(policy_scope(Gin).includes(:gin_items).order(created_at: :desc), each_serializer: GinSerializer)
      end

      def show
        gin = policy_scope(Gin).includes(:gin_items).find(params[:id])
        authorize gin
        render_resource(gin, serializer: GinSerializer)
      end

      def create
        payload = gin_params

        authorize Gin
        gin = GinCreator.new(
          warehouse: accessible_document_warehouse_scope.find(payload[:warehouse_id]),
          issued_on: payload[:issued_on],
          issued_by: Cats::Core::User.find(payload[:issued_by_id]),
          items: payload[:items],
          destination: PolymorphicReferenceResolver.resolve_destination(payload[:destination_type], payload[:destination_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_resource(gin, status: :created, serializer: GinSerializer)
      end

      def confirm
        gin = policy_scope(Gin).find(params[:id])
        authorize gin, :confirm?
        approved_by = params[:approved_by_id].present? ? Cats::Core::User.find(params[:approved_by_id]) : nil

        GinConfirmer.new(gin: gin, approved_by: approved_by).call
        render_resource(gin, serializer: GinSerializer)
      end

      private

      def gin_params
        payload = normalize_payload_aliases(params.require(:payload), items: :gin_items)

        payload.permit(
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
            :inventory_lot_id,
            :entered_unit_id,
            :store_id,
            :stack_id
          ]
        )
      end

    end
  end
end
