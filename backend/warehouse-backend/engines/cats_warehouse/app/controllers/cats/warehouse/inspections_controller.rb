module Cats
  module Warehouse
    class InspectionsController < BaseController
      def index
        inspections = Inspection.includes(:inspection_items).order(created_at: :desc)
        render_success({ inspections: inspections.as_json(include: :inspection_items) })
      end

      def show
        inspection = Inspection.includes(:inspection_items).find_by(id: params[:id])
        return render_error("Inspection not found", status: :not_found) unless inspection

        render_success({ inspection: inspection.as_json(include: :inspection_items) })
      end

      def create
        payload = inspection_params

        inspection = InspectionCreator.new(
          warehouse: Warehouse.find(payload[:warehouse_id]),
          inspected_on: payload[:inspected_on],
          inspector: Cats::Core::User.find(payload[:inspector_id]),
          items: payload[:items],
          source: resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          status: payload[:status] || "Draft"
        ).call

        render_success({ id: inspection.id }, status: :created)
      end

      def confirm
        inspection = Inspection.find(params[:id])
        InspectionConfirmer.new(inspection: inspection).call
        render_success({ id: inspection.id, status: inspection.status })
      end

      private

      def inspection_params
        params.require(:payload).permit(
          :warehouse_id,
          :inspected_on,
          :inspector_id,
          :reference_no,
          :status,
          :source_type,
          :source_id,
          items: [
            :commodity_id,
            :quantity_received,
            :quantity_damaged,
            :quantity_lost,
            :quality_status,
            :packaging_condition,
            :remarks
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
