# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrdersController < BaseController
      include OfficerDispatchV2Feature

      before_action :ensure_officer_dispatch_v2_enabled!, only: [:self_approve, :receive, :transport_record, :update_transport_record]
      def index
        authorize DispatchOrder
        orders = policy_scope(DispatchOrder)
                   .includes(
                     :hub, :warehouse,
                     dispatch_order_lines: [:commodity, :unit, :source_allocations, :destination_allocations]
                   )

        if params[:warehouse_id].present?
          warehouse_id = params[:warehouse_id].to_i
          access = AccessContext.new(user: current_user)
          unless warehouse_accessible?(access, warehouse_id)
            return render_error("Access denied to warehouse #{warehouse_id}", status: :forbidden)
          end

          source_ids = DispatchLineSourceAllocation
            .joins(:dispatch_order_line)
            .where(warehouse_id: warehouse_id)
            .distinct
            .pluck("cats_warehouse_dispatch_order_lines.dispatch_order_id")

          orders = orders.where(warehouse_id: warehouse_id).or(orders.where(id: source_ids))
        end

        orders = orders.where(created_by_id: current_user.id) if params[:created_by].to_s == "me"
        orders = orders.where(status: params[:status]) if params[:status].present?
        orders = orders.where(officer_level: params[:officer_level]) if params[:officer_level].present?

        orders = orders.order(created_at: :desc)
        render_resource(orders, each_serializer: DispatchOrderSerializer)
      end

      def show
        order = load_order(params[:id])
        authorize order
        render_order_payload(order)
      end

      def create
        authorize DispatchOrder
        payload = dispatch_order_params

        if v2_payload?(payload)
          ensure_officer_dispatch_v2_enabled!
          order = DispatchOrderCreatorForOfficer.new(
            actor: current_user,
            plan_reference: payload[:plan_reference],
            description: payload[:description] || payload[:notes],
            lines: payload[:lines] || payload[:dispatch_order_lines] || [],
            dispatch_plan_id: payload[:dispatch_plan_id],
            dispatch_plan_item_id: payload[:dispatch_plan_item_id]
          ).call
        else
          location_attrs = LocationTagger.call(user: current_user)
          warehouse_id = payload[:source_warehouse_id] || payload[:warehouse_id]
          dispatched_date = payload[:expected_pickup_date] || payload[:dispatched_date] || Date.current
          items = payload[:lines] || payload[:dispatch_order_lines] || []
          destination_name = payload[:destination_name] || payload[:name]

          order = DispatchOrderCreator.new(
            hub: find_optional_hub(payload[:hub_id]),
            warehouse: find_optional_warehouse(warehouse_id),
            dispatched_date: dispatched_date,
            created_by: current_user,
            items: items,
            destination: PolymorphicReferenceResolver.resolve_source(payload[:destination_type], payload[:destination_id]),
            reference_no: payload[:reference_no],
            description: payload[:description] || payload[:notes],
            name: destination_name,
            location_id: location_attrs[:location_id],
            hierarchical_level: location_attrs[:hierarchical_level]
          ).call
        end

        order = load_order(order.id)
        render_order_payload(order, status: :created)
      end

      def update
        order = load_order(params[:id])
        authorize order

        payload = dispatch_order_params

        if order.v2_dispatch? || v2_payload?(payload)
          DispatchOrderUpdater.new(
            order: order,
            actor: current_user,
            attributes: {
              description: payload[:description] || payload[:notes]
            }.compact,
            lines: payload[:lines] || payload[:dispatch_order_lines]
          ).call
        else
          update_legacy_order!(order, payload)
        end

        render_order_payload(load_order(order.id))
      end

      def confirm
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :confirm?

        DispatchOrderConfirmer.new(order: order, confirmed_by: current_user).call
        render_order_payload(load_order(order.id))
      end

      def self_approve
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :self_approve?

        DispatchOrderSelfApprovalService.new(order: order, actor: current_user).call
        render_order_payload(load_order(order.id))
      end

      def receive
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :show?

        payload = params.require(:payload).permit(:warehouse_id, :commodity_id, :quantity, :unit_id, :packaging_unit_id, :packaging_size)
        warehouse = Warehouse.find(payload[:warehouse_id])

        pt = DispatchExchangeReceiveService.new(
          dispatch_order: order,
          actor: current_user,
          warehouse: warehouse,
          commodity_id: payload[:commodity_id],
          quantity: payload[:quantity],
          unit_id: payload[:unit_id],
          packaging_unit_id: payload[:packaging_unit_id],
          packaging_size: payload[:packaging_size]
        ).call

        render_success(packaging_transaction_id: pt.id)
      end

      def transport_record
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :show?
        authorize TransportRecord, :create?

        payload = transport_record_params
        tr = TransportRecord.find_or_initialize_by(dispatch_order_id: order.id, warehouse_id: payload[:warehouse_id])
        tr.assign_attributes(
          driver_name: payload[:driver_name],
          license_number: payload[:license_number],
          vehicle_plate: payload[:vehicle_plate],
          phone: payload[:phone],
          recorded_by: current_user
        )
        tr.save!
        render_success(transport_record_id: tr.id)
      end

      def update_transport_record
        transport_record
      end

      def assign
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :assign?

        DispatchOrderAssignmentService.new(
          order: order,
          actor: current_user,
          assignments: assignment_params[:assignments]
        ).call

        render_order_payload(load_order(order.id))
      end

      def reserve_stock
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :reserve_stock?

        StockReservationService.new(
          order: order,
          actor: current_user,
          reservations: stock_reservation_params[:reservations]
        ).call

        render_order_payload(load_order(order.id))
      end

      def workflow
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :workflow?

        render_success(
          id: order.id,
          reference_no: order.reference_no,
          plan_reference: order.plan_reference,
          status: order.status,
          officer_level: order.officer_level,
          workflow_events: ActiveModelSerializers::SerializableResource.new(
            order.workflow_events.includes(:actor).order(occurred_at: :asc, id: :asc),
            each_serializer: WorkflowEventSerializer
          ).as_json
        )
      end

      private

      def load_order(id)
        DispatchOrder.includes(
          :hub, :warehouse,
          dispatch_order_lines: [:commodity, :unit, :source_allocations, :destination_allocations],
          dispatch_order_authorizations: [:warehouse, :dispatch_order_authorization_stores]
        ).find(id)
      end

      def v2_payload?(payload)
        payload[:plan_reference].present?
      end

      def warehouse_accessible?(access, warehouse_id)
        ids = access.accessible_warehouse_ids
        ids = ids.pluck(:id) if ids.is_a?(ActiveRecord::Relation)
        Array(ids).map(&:to_i).include?(warehouse_id)
      end

      def render_order_payload(order, status: :ok)
        payload = ActiveModelSerializers::SerializableResource.new(
          order,
          serializer: DispatchOrderSerializer
        ).as_json
        payload = payload.merge(can_confirm: DispatchOrderPolicy.new(current_user, order).confirm?)
        payload = payload.merge(can_self_approve: DispatchOrderPolicy.new(current_user, order).self_approve?)
        render_success(payload, status: status)
      end

      def update_legacy_order!(order, payload)
        DispatchOrder.transaction do
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
      end

      def dispatch_order_params
        payload = params.require(:payload)
        payload.permit(
          :hub_id,
          :warehouse_id,
          :source_warehouse_id,
          :dispatched_date,
          :expected_pickup_date,
          :reference_no,
          :plan_reference,
          :name,
          :destination_name,
          :description,
          :notes,
          :destination_type,
          :destination_id,
          :dispatch_plan_id,
          :dispatch_plan_item_id,
          dispatch_order_lines: line_permit_list,
          lines: line_permit_list
        )
      end

      def line_permit_list
        [
          :commodity_id,
          :quantity,
          :unit_id,
          :notes,
          :remarks,
          :packaging_unit_id,
          :packaging_size,
          { source_allocations: [:warehouse_id, :quantity, :unit_id] },
          { destination_allocations: [:destination_location_id, :quantity, :unit_id] }
        ]
      end

      def transport_record_params
        params.require(:payload).permit(:warehouse_id, :driver_name, :license_number, :vehicle_plate, :phone)
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
