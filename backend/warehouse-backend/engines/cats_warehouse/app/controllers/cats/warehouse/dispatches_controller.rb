module Cats
  module Warehouse
    class DispatchesController < BaseController
      def index
        authorize :dispatch, :index?, policy_class: DispatchPolicy
        render_resource(policy_scope(Cats::Core::Dispatch, policy_scope_class: DispatchPolicy::Scope).order(created_at: :desc), each_serializer: DispatchSerializer)
      end

      def show
        dispatch = policy_scope(Cats::Core::Dispatch, policy_scope_class: DispatchPolicy::Scope).find(params[:id])
        authorize :dispatch, :show?, policy_class: DispatchPolicy
        render_resource(dispatch, serializer: DispatchSerializer)
      end

      def create
        authorize :dispatch, :create?, policy_class: DispatchPolicy
        payload = dispatch_params
        dispatch_plan_item = DispatchPlanItem.find(payload[:dispatch_plan_item_id])
        DispatchPlanItemAuthorizationGuard.new(dispatch_plan_item: dispatch_plan_item).ensure_dispatchable!

        dispatch = Cats::Core::Dispatch.create!(
          reference_no: payload[:reference_no],
          dispatch_plan_item_id: payload[:dispatch_plan_item_id],
          transporter_id: payload[:transporter_id],
          plate_no: payload[:plate_no],
          driver_name: payload[:driver_name],
          driver_phone: payload[:driver_phone],
          quantity: payload[:quantity],
          unit_id: payload[:unit_id],
          commodity_status: payload[:commodity_status].presence || "Good",
          remark: payload[:remark],
          prepared_by_id: payload[:prepared_by_id],
          dispatch_status: payload[:dispatch_status].presence || "Draft"
        )

        render_resource(dispatch, status: :created, serializer: DispatchSerializer)
      end

      private

      def dispatch_params
        params.require(:payload).permit(
          :reference_no,
          :dispatch_plan_item_id,
          :transporter_id,
          :plate_no,
          :driver_name,
          :driver_phone,
          :quantity,
          :unit_id,
          :commodity_status,
          :remark,
          :prepared_by_id,
          :dispatch_status
        )
      end
    end
  end
end
