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
          hub: find_optional_hub(payload[:hub_id]),
          warehouse: find_optional_warehouse(payload[:warehouse_id]),
          dispatched_date: payload[:dispatched_date],
          created_by: current_user,
          items: payload[:dispatch_order_lines],
          destination: PolymorphicReferenceResolver.resolve_source(payload[:destination_type], payload[:destination_id]),
          reference_no: payload[:reference_no],
          description: payload[:description],
          name: payload[:name]
        ).call

        render_order_payload(order, status: :created)
      end

      def update
        order = policy_scope(DispatchOrder).includes(:dispatch_order_lines).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft dispatch orders can be updated" unless order.status_draft?

        DispatchOrder.transaction do
          payload = dispatch_order_params
          order.assign_attributes(
            hub: payload.key?(:hub_id) ? find_optional_hub(payload[:hub_id]) : order.hub,
            warehouse: payload.key?(:warehouse_id) ? find_optional_warehouse(payload[:warehouse_id]) : order.warehouse,
            dispatched_date: payload.key?(:dispatched_date) ? payload[:dispatched_date] : order.dispatched_date,
            destination: payload.key?(:destination_type) || payload.key?(:destination_id) ? PolymorphicReferenceResolver.resolve_source(payload[:destination_type], payload[:destination_id]) : order.destination,
            reference_no: payload.key?(:reference_no) ? payload[:reference_no].presence : order.reference_no,
            description: payload.key?(:description) ? payload[:description] : order.description,
            name: payload.key?(:name) ? payload[:name] : order.name
          )
          order.save!

          replace_dispatch_order_lines!(order, payload[:dispatch_order_lines]) if payload.key?(:dispatch_order_lines)
        end

        render_order_payload(order.reload)
      end

      def confirm
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order

        DispatchOrderConfirmer.new(order: order, confirmed_by: current_user).call
        render_order_payload(order.reload)
      end

      def assign
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :assign?

        DispatchOrderAssignmentService.new(
          order: order,
          actor: current_user,
          assignments: assignment_params[:assignments]
        ).call

        render_order_payload(order.reload)
      end

      def reserve_stock
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :reserve_stock?

        StockReservationService.new(
          order: order,
          actor: current_user,
          reservations: stock_reservation_params[:reservations]
        ).call

        render_order_payload(order.reload)
      end

      def workflow
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :workflow?

        render_success(
          workflow_events: ActiveModelSerializers::SerializableResource.new(
            order.workflow_events.order(occurred_at: :asc, id: :asc),
            each_serializer: WorkflowEventSerializer
          ).as_json
        )
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
          :name,
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

      def assignment_params
        params.require(:payload).permit(assignments: [
          :dispatch_order_line_id,
          :hub_id,
          :warehouse_id,
          :store_id,
          :assigned_to_id,
          :quantity,
          :status
        ])
      end

      def stock_reservation_params
        params.require(:payload).permit(reservations: [
          :dispatch_order_line_id,
          :warehouse_id,
          :store_id,
          :stack_id,
          :commodity_id,
          :unit_id,
          :inventory_lot_id,
          :reserved_quantity,
          :issued_quantity,
          :status
        ])
      end

      def find_optional_hub(id)
        id.present? ? Hub.find(id) : nil
      end

      def find_optional_warehouse(id)
        id.present? ? Warehouse.find(id) : nil
      end

      def replace_dispatch_order_lines!(order, items)
        order.dispatch_order_lines.destroy_all

        Array(items).each do |item|
          order.dispatch_order_lines.create!(
            commodity_id: item[:commodity_id],
            quantity: item[:quantity],
            unit_id: item[:unit_id]
          )
        end
      end
    end
  end
end
