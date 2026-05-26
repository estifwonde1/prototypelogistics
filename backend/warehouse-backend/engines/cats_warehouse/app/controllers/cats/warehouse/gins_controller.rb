module Cats
  module Warehouse
    class GinsController < BaseController
      def index
        authorize Gin
        scope = policy_scope(Gin).includes(:gin_items).order(created_at: :desc)
        scope = scope.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
        render_resource(scope, each_serializer: GinSerializer)
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
          status: payload[:status] || "draft"
        ).call

        render_resource(gin, status: :created, serializer: GinSerializer)
      end

      def stack_allocations
        gin = policy_scope(Gin).find(params[:id])
        authorize gin, :confirm?

        allocations = Array(params.require(:payload).permit(allocations: [:stack_id, :quantity, :commodity_id, :commodity_grade, :gin_item_id])[:allocations])
        GinStackAllocationValidator.new(gin: gin, allocations: allocations).call

        Gin.transaction do
          allocations.each do |row|
            DispatchStackAllocation.create!(
              gin: gin,
              stack_id: row[:stack_id],
              quantity: row[:quantity],
              base_quantity: row[:quantity],
              commodity_grade: row[:commodity_grade]
            )

            item = gin.gin_items.find_by(commodity_id: row[:commodity_id]) || gin.gin_items.first
            item&.update!(stack_id: row[:stack_id])
          end
        end

        render_success(gin_id: gin.id, allocations_count: allocations.size)
      end

      def confirm
        gin = policy_scope(Gin).find(params[:id])
        authorize gin, :confirm?
        approved_by = params[:approved_by_id].present? ? Cats::Core::User.find(params[:approved_by_id]) : current_user

        GinConfirmer.new(
          gin: gin,
          approved_by: approved_by,
          idempotency_key: request.headers["Idempotency-Key"]
        ).call
        render_resource(gin.reload, serializer: GinSerializer)
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
            :batch_no,
            :expiry_date,
            :entered_unit_id,
            :base_unit_id,
            :base_quantity,
            :store_id,
            :stack_id
          ]
        )
      end

    end
  end
end
