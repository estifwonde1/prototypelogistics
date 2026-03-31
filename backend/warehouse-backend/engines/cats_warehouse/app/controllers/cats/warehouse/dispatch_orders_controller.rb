module Cats
  module Warehouse
    class DispatchOrdersController < BaseController
      def index
        authorize DispatchOrder
        orders = policy_scope(DispatchOrder).includes(:hub, :warehouse, :dispatch_order_lines).order(created_at: :desc)
        render_resource(orders, each_serializer: DispatchOrderSerializer)
      end

      def show
        order = policy_scope(DispatchOrder).includes(:hub, :warehouse, :dispatch_order_lines).find(params[:id])
        authorize order
        render_order_payload(order)
      end

      def create
        payload = dispatch_order_params
        authorize DispatchOrder

        order = DispatchOrderCreator.new(
          hub: Hub.find(payload[:hub_id]),
          warehouse: Warehouse.find(payload[:warehouse_id]),
          dispatched_date: payload[:dispatched_date],
          created_by: current_user,
          items: payload[:dispatch_order_lines],
          destination: PolymorphicReferenceResolver.resolve_source(payload[:destination_type], payload[:destination_id]),
          reference_no: payload[:reference_no],
          description: payload[:description]
        ).call

        render_order_payload(order, status: :created)
      end

      def confirm
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order

        DispatchOrderConfirmer.new(order: order, confirmed_by: current_user).call
        render_order_payload(order.reload)
      end

      private

      def render_order_payload(order, status: :ok)
        payload = ActiveModelSerializers::SerializableResource.new(
          order,
          serializer: DispatchOrderSerializer
        ).as_json
        payload = payload.merge(can_confirm: DispatchOrderPolicy.new(current_user, order).confirm?)
        render_success(payload, status: status)
      end

      def dispatch_order_params
        payload = params.require(:payload)
        payload.permit(
          :hub_id,
          :warehouse_id,
          :dispatched_date,
          :reference_no,
          :description,
          :destination_type,
          :destination_id,
          dispatch_order_lines: [
            :commodity_id,
            :quantity,
            :unit_id
          ]
        )
      end
    end
  end
end
