module Cats
  module Warehouse
    class WaybillsController < BaseController
      def index
        waybills = Waybill.includes(:waybill_items, :waybill_transport).order(created_at: :desc)
        render_success({ waybills: waybills.as_json(include: [ :waybill_items, :waybill_transport ]) })
      end

      def show
        waybill = Waybill.includes(:waybill_items, :waybill_transport).find_by(id: params[:id])
        return render_error("Waybill not found", status: :not_found) unless waybill

        render_success({ waybill: waybill.as_json(include: [ :waybill_items, :waybill_transport ]) })
      end

      def create
        payload = waybill_params

        waybill = WaybillCreator.new(
          reference_no: payload[:reference_no],
          issued_on: payload[:issued_on],
          source_location: Cats::Core::Location.find(payload[:source_location_id]),
          destination_location: Cats::Core::Location.find(payload[:destination_location_id]),
          items: payload[:items],
          transport: payload[:transport],
          dispatch: resolve_dispatch(payload[:dispatch_id]),
          status: payload[:status]
        ).call

        render_success({ id: waybill.id }, status: :created)
      end

      def confirm
        waybill = Waybill.find(params[:id])
        WaybillConfirmer.new(waybill: waybill).call
        render_success({ id: waybill.id, status: waybill.status })
      end

      private

      def waybill_params
        params.require(:payload).permit(
          :reference_no,
          :issued_on,
          :source_location_id,
          :destination_location_id,
          :dispatch_id,
          :status,
          transport: [
            :transporter_id,
            :vehicle_plate_no,
            :driver_name,
            :driver_phone
          ],
          items: [
            :commodity_id,
            :quantity,
            :unit_id
          ]
        )
      end

      def resolve_dispatch(dispatch_id)
        return nil if dispatch_id.blank?

        Cats::Core::Dispatch.find(dispatch_id)
      end
    end
  end
end
