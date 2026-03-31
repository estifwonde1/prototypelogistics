module Cats
  module Warehouse
    class WaybillsController < BaseController
      def index
        authorize Waybill
        render_resource(policy_scope(Waybill).includes(:waybill_items, :waybill_transport).order(created_at: :desc), each_serializer: WaybillSerializer)
      end

      def show
        waybill = policy_scope(Waybill).includes(:waybill_items, :waybill_transport).find(params[:id])
        authorize waybill
        render_resource(waybill, serializer: WaybillSerializer)
      end

      def create
        payload = waybill_params

        authorize Waybill
        dispatch = resolve_dispatch(payload[:dispatch_id])
        ensure_dispatch_dispatchable!(dispatch)

        waybill = WaybillCreator.new(
          reference_no: payload[:reference_no],
          issued_on: payload[:issued_on],
          source_location: Cats::Core::Location.find(payload[:source_location_id]),
          destination_location: Cats::Core::Location.find(payload[:destination_location_id]),
          items: payload[:items],
          transport: payload[:transport],
          dispatch: dispatch,
          status: payload[:status]
        ).call

        render_resource(waybill, status: :created, serializer: WaybillSerializer)
      end

      def confirm
        waybill = policy_scope(Waybill).find(params[:id])
        authorize waybill, :confirm?
        WaybillConfirmer.new(waybill: waybill).call
        render_resource(waybill, serializer: WaybillSerializer)
      end

      private

      def waybill_params
        payload = normalize_payload_aliases(
          params.require(:payload),
          items: :waybill_items,
          transport: :waybill_transport
        )

        payload.permit(
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

      def ensure_dispatch_dispatchable!(dispatch)
        return if dispatch.blank?

        dispatch_plan_item = DispatchPlanItem.find_by(id: dispatch.dispatch_plan_item_id)
        return if dispatch_plan_item.blank?

        guard = DispatchPlanItemAuthorizationGuard.new(dispatch_plan_item: dispatch_plan_item)
        guard.ensure_dispatchable!
        guard.ensure_plan_approved_for_dispatch!
      end
    end
  end
end
