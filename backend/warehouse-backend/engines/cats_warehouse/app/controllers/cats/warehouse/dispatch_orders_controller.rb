module Cats
  module Warehouse
    class DispatchOrdersController < BaseController
      def index
        authorize DispatchOrder
        orders = policy_scope(DispatchOrder).includes(
          :hub, :warehouse,
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        )
        
        # CRITICAL: Filter by warehouse_id if provided (for warehouse managers with multiple warehouses)
        # Include orders where:
        # 1. warehouse_id matches directly (source warehouse), OR
        # 2. Order has an assignment to this warehouse (via dispatch_order_assignments if they exist)
        if params[:warehouse_id].present?
          warehouse_id = params[:warehouse_id].to_i
          
          # Verify user has access to this warehouse
          access = AccessContext.new(user: current_user)
          unless access.can_access_warehouse?(warehouse_id)
            return render_error("Access denied to warehouse #{warehouse_id}", status: :forbidden)
          end
          
          warehouse = Warehouse.find_by(id: warehouse_id)
          # Hub-affiliated warehouse managers receive dispatch plans via the hub, not at WH level.
          if warehouse&.hub_id.present?
            orders = orders.none
          else
            line_order_ids = DispatchOrderLine.where(warehouse_id: warehouse_id).distinct.pluck(:dispatch_order_id)
            orders = orders.where(warehouse_id: warehouse_id).or(orders.where(id: line_order_ids))
          end
        end

        if params[:hub_id].present?
          hub_id = params[:hub_id].to_i
          access = AccessContext.new(user: current_user)
          hub_ids = access.accessible_hub_ids
          allowed =
            if hub_ids.is_a?(ActiveRecord::Relation)
              hub_ids.where(id: hub_id).exists?
            else
              Array(hub_ids).map(&:to_i).include?(hub_id)
            end
          unless allowed
            return render_error("Access denied to hub #{hub_id}", status: :forbidden)
          end

          warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)
          line_hub_order_ids = DispatchOrderLine.where(hub_id: hub_id).distinct.pluck(:dispatch_order_id)
          line_wh_order_ids =
            if warehouse_ids.any?
              DispatchOrderLine.where(warehouse_id: warehouse_ids).distinct.pluck(:dispatch_order_id)
            else
              []
            end
          assignment_order_ids =
            DispatchOrderAssignment.where(hub_id: hub_id).distinct.pluck(:dispatch_order_id)
          linked_ids = (line_hub_order_ids + line_wh_order_ids + assignment_order_ids).uniq

          orders = orders.where(hub_id: hub_id)
          orders = orders.or(orders.where(warehouse_id: warehouse_ids)) if warehouse_ids.any?
          orders = orders.or(orders.where(id: linked_ids)) if linked_ids.any?
        end
        
        orders = orders.order(created_at: :desc)
        render_resource(orders, each_serializer: DispatchOrderSerializer)
      end

      def show
        order = policy_scope(DispatchOrder).includes(
          :hub, :warehouse,
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        ).find(params[:id])
        authorize order
        render_order_payload(order)
      end

      def create
        payload = dispatch_order_params
        authorize DispatchOrder

        # Get location tagging from the current user's assignment
        location_attrs = LocationTagger.call(user: current_user)

        # Map frontend params to backend params
        warehouse_id = payload[:source_warehouse_id] || payload[:warehouse_id]
        warehouse = find_optional_warehouse(warehouse_id)
        dispatched_date = payload[:expected_pickup_date] || payload[:dispatched_date] || Date.today
        items = payload[:lines] || payload[:dispatch_order_lines] || []
        destination_name = payload[:destination_name] || payload[:name]
        hub = find_optional_hub(payload[:hub_id]) || warehouse&.hub
        fdp = find_optional_fdp(payload[:fdp_id])

        order = DispatchOrderCreator.new(
          hub: hub,
          warehouse: warehouse,
          dispatched_date: dispatched_date,
          created_by: current_user,
          items: items,
          destination: PolymorphicReferenceResolver.resolve_source(payload[:destination_type], payload[:destination_id]),
          reference_no: payload[:reference_no],
          description: payload[:description] || payload[:notes],
          name: destination_name || fdp&.name,
          location_id: location_attrs[:location_id],
          hierarchical_level: location_attrs[:hierarchical_level],
          fdp: fdp,
          response_plan_ref: payload[:response_plan_ref],
          approval_date: payload[:approval_date],
          response_type: payload[:response_type]
        ).call

        # Reload with proper associations
        order = DispatchOrder.includes(
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        ).find(order.id)
        render_order_payload(order, status: :created)
      end

      def update
        order = policy_scope(DispatchOrder).includes(dispatch_order_lines: [:commodity, :unit]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft dispatch orders can be updated" unless order.status_draft?

        DispatchOrder.transaction do
          payload = dispatch_order_params
          order.assign_attributes(
            hub: payload.key?(:hub_id) ? find_optional_hub(payload[:hub_id]) : order.hub,
            warehouse: payload.key?(:warehouse_id) || payload.key?(:source_warehouse_id) ? find_optional_warehouse(payload[:warehouse_id] || payload[:source_warehouse_id]) : order.warehouse,
            dispatched_date: payload.key?(:dispatched_date) || payload.key?(:expected_pickup_date) ? (payload[:expected_pickup_date] || payload[:dispatched_date]) : order.dispatched_date,
            destination: payload.key?(:destination_type) || payload.key?(:destination_id) ? PolymorphicReferenceResolver.resolve_source(payload[:destination_type], payload[:destination_id]) : order.destination,
            reference_no: payload.key?(:reference_no) ? payload[:reference_no].presence : order.reference_no,
            description: payload.key?(:description) || payload.key?(:notes) ? (payload[:description] || payload[:notes]) : order.description,
            name: payload.key?(:name) || payload.key?(:destination_name) ? (payload[:destination_name] || payload[:name]) : order.name,
            fdp: payload.key?(:fdp_id) ? find_optional_fdp(payload[:fdp_id]) : order.fdp,
            response_plan_ref: payload.key?(:response_plan_ref) ? payload[:response_plan_ref] : order.response_plan_ref,
            approval_date: payload.key?(:approval_date) ? payload[:approval_date] : order.approval_date,
            response_type: payload.key?(:response_type) ? payload[:response_type] : order.response_type
          )
          order.save!

          replace_dispatch_order_lines!(order, payload[:dispatch_order_lines] || payload[:lines]) if payload.key?(:dispatch_order_lines) || payload.key?(:lines)
        end

        order = DispatchOrder.includes(
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        ).find(order.id)
        render_order_payload(order)
      end

      def destroy
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft dispatch orders can be deleted" unless order.status_draft?

        DispatchOrder.transaction do
          order.destroy!
        end

        render_success({ deleted_id: order.id }, status: :ok)
      end

      def confirm
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :confirm?

        DispatchOrderConfirmer.new(order: order, confirmed_by: current_user).call
        order = DispatchOrder.includes(
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        ).find(order.id)
        render_order_payload(order)
      end

      def assign
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :assign?

        DispatchOrderAssignmentService.new(
          order: order,
          actor: current_user,
          assignments: assignment_params[:assignments]
        ).call

        order = DispatchOrder.includes(
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        ).find(order.id)
        render_order_payload(order)
      end

      def reserve_stock
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :reserve_stock?

        StockReservationService.new(
          order: order,
          actor: current_user,
          reservations: stock_reservation_params[:reservations]
        ).call

        order = DispatchOrder.includes(
          dispatch_order_lines: [:commodity, :unit, :warehouse, :hub, :fdp]
        ).find(order.id)
        render_order_payload(order)
      end

      def workflow
        order = policy_scope(DispatchOrder).find(params[:id])
        authorize order, :workflow?

        render_success(
          workflow_events: ActiveModelSerializers::SerializableResource.new(
            order.workflow_events.includes(:actor).order(occurred_at: :asc, id: :asc),
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
          :source_warehouse_id,       # NEW: Accept frontend param name
          :dispatched_date,
          :expected_pickup_date,      # NEW: Accept frontend param name
          :reference_no,
          :name,
          :destination_name,          # NEW: Accept frontend param name
          :description,
          :notes,                     # NEW: Accept frontend param name
          :destination_type,
          :destination_id,
          :response_plan_ref,
          :approval_date,
          :response_type,
          :fdp_id,
          dispatch_order_lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :warehouse_id,
            :hub_id,
            :fdp_id,
            :expected_receive_at,
            :notes
          ],
          lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :warehouse_id,
            :hub_id,
            :fdp_id,
            :expected_receive_at,
            :notes
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

      def find_optional_fdp(id)
        id.present? ? Fdp.find(id) : nil
      end

      def replace_dispatch_order_lines!(order, items)
        order.dispatch_order_lines.destroy_all

        Array(items).each do |item|
          line_warehouse = find_optional_warehouse(item[:warehouse_id])
          line_hub = find_optional_hub(item[:hub_id]) || line_warehouse&.hub

          order.dispatch_order_lines.create!(
            commodity_id: item[:commodity_id],
            quantity: item[:quantity],
            unit_id: item[:unit_id],
            warehouse_id: line_warehouse&.id,
            hub_id: line_hub&.id,
            fdp_id: item[:fdp_id],
            expected_receive_at: item[:expected_receive_at]
          )
        end
      end
    end
  end
end
