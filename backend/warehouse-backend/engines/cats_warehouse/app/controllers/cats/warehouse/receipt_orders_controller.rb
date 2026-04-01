module Cats
  module Warehouse
    class ReceiptOrdersController < BaseController
      def index
        authorize ReceiptOrder
        orders = policy_scope(ReceiptOrder).includes(:hub, :warehouse, receipt_order_lines: [:commodity, :unit]).order(created_at: :desc)
        render_resource(orders, each_serializer: ReceiptOrderSerializer)
      end

      def show
        order = policy_scope(ReceiptOrder).includes(:hub, :warehouse, receipt_order_lines: [:commodity, :unit]).find(params[:id])
        authorize order
        render_order_payload(order)
      end

      def create
        payload = receipt_order_params
        authorize ReceiptOrder

        # Map frontend params to backend params
        warehouse_id = payload[:destination_warehouse_id] || payload[:warehouse_id]
        received_date = payload[:expected_delivery_date] || payload[:received_date] || Date.today
        items = payload[:lines] || payload[:receipt_order_lines] || []
        source_name = payload[:source_name] || payload[:name]

        order = ReceiptOrderCreator.new(
          hub: find_optional_hub(payload[:hub_id]),
          warehouse: find_optional_warehouse(warehouse_id),
          received_date: received_date,
          created_by: current_user,
          items: items,
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          description: payload[:description] || payload[:notes],
          name: source_name
        ).call

        # Reload with proper associations
        order = ReceiptOrder.includes(receipt_order_lines: [:commodity, :unit]).find(order.id)
        render_order_payload(order, status: :created)
      end

      def update
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity, :unit]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be updated" unless order.status_draft?

        ReceiptOrder.transaction do
          payload = receipt_order_params
          order.assign_attributes(
            hub: payload.key?(:hub_id) ? find_optional_hub(payload[:hub_id]) : order.hub,
            warehouse: payload.key?(:warehouse_id) ? find_optional_warehouse(payload[:warehouse_id]) : order.warehouse,
            received_date: payload.key?(:received_date) ? payload[:received_date] : order.received_date,
            source: payload.key?(:source_type) || payload.key?(:source_id) ? PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]) : order.source,
            reference_no: payload.key?(:reference_no) ? payload[:reference_no].presence : order.reference_no,
            description: payload.key?(:description) ? payload[:description] : order.description,
            name: payload.key?(:name) ? payload[:name] : order.name
          )
          order.save!

          replace_receipt_order_lines!(order, payload[:receipt_order_lines]) if payload.key?(:receipt_order_lines)
        end

        order = ReceiptOrder.includes(receipt_order_lines: [:commodity, :unit]).find(order.id)
        render_order_payload(order)
      end

      def confirm
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order

        ReceiptOrderConfirmer.new(order: order, confirmed_by: current_user).call
        order = ReceiptOrder.includes(receipt_order_lines: [:commodity, :unit]).find(order.id)
        render_order_payload(order)
      end

      def assign
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :assign?

        ReceiptOrderAssignmentService.new(
          order: order,
          actor: current_user,
          assignments: assignment_params[:assignments]
        ).call

        order = ReceiptOrder.includes(receipt_order_lines: [:commodity, :unit]).find(order.id)
        render_order_payload(order)
      end

      def reserve_space
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :reserve_space?

        SpaceReservationService.new(
          order: order,
          actor: current_user,
          reservations: space_reservation_params[:reservations]
        ).call

        order = ReceiptOrder.includes(receipt_order_lines: [:commodity, :unit]).find(order.id)
        render_order_payload(order)
      end

      def workflow
        order = policy_scope(ReceiptOrder).find(params[:id])
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
          :destination_warehouse_id,  # NEW: Accept frontend param name
          :received_date,
          :expected_delivery_date,    # NEW: Accept frontend param name
          :reference_no,
          :name,
          :source_name,               # NEW: Accept frontend param name
          :description,
          :notes,                     # NEW: Accept frontend param name
          :source_type,
          :source_id,
          receipt_order_lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :unit_price,              # NEW: Accept frontend param name
            :notes                    # NEW: Accept frontend param name
          ],
          lines: [                    # NEW: Accept frontend param name
            :commodity_id,
            :quantity,
            :unit_id,
            :unit_price,
            :notes
          ]
        )
      end

      def assignment_params
        params.require(:payload).permit(assignments: [
          :receipt_order_line_id,
          :hub_id,
          :warehouse_id,
          :store_id,
          :assigned_to_id,
          :quantity,
          :status
        ])
      end

      def space_reservation_params
        params.require(:payload).permit(reservations: [
          :receipt_order_line_id,
          :receipt_order_assignment_id,
          :warehouse_id,
          :store_id,
          :reserved_quantity,
          :reserved_volume,
          :status
        ])
      end

      def find_optional_hub(id)
        id.present? ? Hub.find(id) : nil
      end

      def find_optional_warehouse(id)
        id.present? ? Warehouse.find(id) : nil
      end

      def replace_receipt_order_lines!(order, items)
        order.receipt_order_lines.destroy_all

        Array(items).each do |item|
          order.receipt_order_lines.create!(
            commodity_id: item[:commodity_id],
            quantity: item[:quantity],
            unit_id: item[:unit_id]
          )
        end
      end
    end
  end
end
