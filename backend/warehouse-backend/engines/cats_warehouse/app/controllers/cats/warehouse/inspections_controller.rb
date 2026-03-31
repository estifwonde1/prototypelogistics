module Cats
  module Warehouse
    class InspectionsController < BaseController
      def index
        authorize Inspection
        render_resource(policy_scope(Inspection).includes(:inspection_items).order(created_at: :desc), each_serializer: InspectionSerializer)
      end

      def show
        inspection = policy_scope(Inspection).includes(:inspection_items).find(params[:id])
        authorize inspection
        render_resource(inspection, serializer: InspectionSerializer)
      end

      def create
        payload = inspection_params

        authorize Inspection
        warehouse = policy_scope(Warehouse).find(payload[:warehouse_id])
        inspection = InspectionCreator.new(
          warehouse: warehouse,
          inspected_on: payload[:inspected_on],
          inspector: Cats::Core::User.find(payload[:inspector_id]),
          items: payload[:items],
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_resource(inspection, status: :created, serializer: InspectionSerializer)
      end

      def confirm
        inspection = policy_scope(Inspection).find(params[:id])
        authorize inspection, :confirm?
        InspectionConfirmer.new(inspection: inspection).call
        render_resource(inspection, serializer: InspectionSerializer)
      end

      private

      def inspection_params
        payload = normalize_payload_aliases(params.require(:payload), items: :inspection_items)

        payload.permit(
          :warehouse_id,
          :inspected_on,
          :inspector_id,
          :reference_no,
          :status,
          :source_type,
          :source_id,
          items: [
            :commodity_id,
            :unit_id,
            :inventory_lot_id,
            :batch_no,
            :expiry_date,
            :entered_unit_id,
            :quantity_received,
            :quantity_damaged,
            :quantity_lost,
            :quality_status,
            :packaging_condition,
            :remarks
          ]
        )
      end

    end
  end
end
