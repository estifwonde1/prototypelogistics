module Cats
  module Warehouse
    class ReceiptOrdersController < BaseController
      def index
        authorize ReceiptOrder
        orders = policy_scope(ReceiptOrder).includes(:hub, :warehouse, :receipt_order_lines).order(created_at: :desc)
        render_resource(orders, each_serializer: ReceiptOrderSerializer)
      end

      def show
        order = policy_scope(ReceiptOrder).includes(:hub, :warehouse, :receipt_order_lines).find(params[:id])
        authorize order
        render_order_payload(order)
      end

      def create
        payload = receipt_order_params
        authorize ReceiptOrder

        order = ReceiptOrderCreator.new(
          hub: Hub.find(payload[:hub_id]),
          warehouse: Warehouse.find(payload[:warehouse_id]),
          received_date: payload[:received_date],
          created_by: current_user,
          items: payload[:receipt_order_lines],
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          description: payload[:description]
        ).call

        render_order_payload(order, status: :created)
      end

      def confirm
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order

        ReceiptOrderConfirmer.new(order: order, confirmed_by: current_user).call
        render_order_payload(order.reload)
      end

      private

      def render_order_payload(order, status: :ok)
        payload = ActiveModelSerializers::SerializableResource.new(
          order,
          serializer: ReceiptOrderSerializer
        ).as_json
        payload = payload.merge(can_confirm: ReceiptOrderPolicy.new(current_user, order).confirm?)
        render_success(payload, status: status)
      end

      def receipt_order_params
        payload = params.require(:payload)
        payload.permit(
          :hub_id,
          :warehouse_id,
          :received_date,
          :reference_no,
          :description,
          :source_type,
          :source_id,
          receipt_order_lines: [
            :commodity_id,
            :quantity,
            :unit_id
          ]
        )
      end
    end
  end
end
