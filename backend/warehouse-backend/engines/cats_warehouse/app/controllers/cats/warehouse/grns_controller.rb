module Cats
  module Warehouse
    class GrnsController < BaseController
      def index
        authorize Grn
        render_resource(Grn.includes(:grn_items).order(created_at: :desc), each_serializer: GrnSerializer)
      end

      def show
        grn = Grn.includes(:grn_items).find(params[:id])
        authorize grn
        render_resource(grn, serializer: GrnSerializer)
      end

      def create
        payload = grn_params

        authorize Grn
        grn = GrnCreator.new(
          warehouse: Warehouse.find(payload[:warehouse_id]),
          received_on: payload[:received_on],
          received_by: Cats::Core::User.find(payload[:received_by_id]),
          items: payload[:items],
          source: resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_resource(grn, status: :created, serializer: GrnSerializer)
      end

      def confirm
        grn = Grn.find(params[:id])
        authorize grn, :confirm?
        approved_by = params[:approved_by_id].present? ? Cats::Core::User.find(params[:approved_by_id]) : nil

        GrnConfirmer.new(grn: grn, approved_by: approved_by).call
        render_resource(grn, serializer: GrnSerializer)
      end

      private

      def grn_params
        params.require(:payload).permit(
          :warehouse_id,
          :received_on,
          :received_by_id,
          :reference_no,
          :status,
          :source_type,
          :source_id,
          items: [
            :commodity_id,
            :quantity,
            :unit_id,
            :quality_status,
            :store_id,
            :stack_id
          ]
        )
      end

      def resolve_source(source_type, source_id)
        return nil if source_type.blank? || source_id.blank?

        source_type.constantize.find(source_id)
      end
    end
  end
end
