module Cats
  module Warehouse
    class ReceiptOrdersController < BaseController
      def index
        authorize ReceiptOrder
        
        # CRITICAL: For warehouse managers with warehouse_id parameter, we need to filter
        # BEFORE policy_scope to ensure we only get orders for the active warehouse
        if params[:warehouse_id].present?
          warehouse_id = params[:warehouse_id].to_i
          
          # Get store IDs for this warehouse
          store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)
          
          # Find receipt order IDs that are assigned to this warehouse or its stores
          assigned_order_ids = ReceiptOrderAssignment
            .where(warehouse_id: warehouse_id)
            .or(ReceiptOrderAssignment.where(store_id: store_ids))
            .where.not(status: 'rejected')
            .distinct
            .pluck(:receipt_order_id)
          
          # Get orders where:
          # 1. Main warehouse_id matches, OR
          # 2. Order has an assignment to this warehouse/stores
          orders = ReceiptOrder
            .where(warehouse_id: warehouse_id)
            .or(ReceiptOrder.where(id: assigned_order_ids))
            .includes(*order_detail_includes)
            .order(created_at: :desc)
          
          # Apply policy scope for authorization
          orders = policy_scope(orders)
        else
          # No warehouse filter - use standard policy scope
          orders = policy_scope(ReceiptOrder)
            .includes(*order_detail_includes)
            .order(created_at: :desc)
        end
        
        render_resource(orders, each_serializer: ReceiptOrderSerializer)
      end

      def show
        order = policy_scope(ReceiptOrder).includes(:hub, :warehouse).find(params[:id])
        authorize order

        assignments = order.receipt_order_assignments
          .includes(:assigned_to, :assigned_by, :store, :warehouse, :hub)

        if hub_manager?
          assignments = assignments.where(
            "cats_warehouse_receipt_order_assignments.store_id IS NULL"
          )
        elsif warehouse_manager?
          # CRITICAL: Filter by active warehouse context, not all warehouses user has access to
          # If warehouse_id param is provided, use it (for multi-warehouse managers)
          # Otherwise, get all warehouses user is assigned to
          if params[:warehouse_id].present?
            active_warehouse_id = params[:warehouse_id].to_i
            wh_ids = [active_warehouse_id]
            store_ids = Cats::Warehouse::Store.where(warehouse_id: active_warehouse_id).pluck(:id)
          else
            wh_ids = UserAssignment.where(user: current_user, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
            store_ids = Cats::Warehouse::Store.where(warehouse_id: wh_ids).pluck(:id)
          end
          
          assignments = assignments.where(
            "cats_warehouse_receipt_order_assignments.hub_id IS NULL OR cats_warehouse_receipt_order_assignments.warehouse_id IN (?) OR cats_warehouse_receipt_order_assignments.store_id IN (?)",
            wh_ids.presence || [0],
            store_ids.presence || [0]
          )
        end

        serialized = ReceiptOrderSerializer.new(order).as_json
        serialized[:receipt_order_assignments] = ActiveModelSerializers::SerializableResource.new(
          assignments,
          each_serializer: ReceiptOrderAssignmentSerializer
        ).as_json

        render_success(serialized)
      end

      def create
        payload = receipt_order_params
        authorize ReceiptOrder

        # Get location tagging from the current user's assignment
        location_attrs = LocationTagger.call(user: current_user)

        # Map frontend params to backend params
        warehouse_id = payload[:destination_warehouse_id].presence || payload[:warehouse_id].presence
        received_date = payload[:expected_delivery_date] || payload[:received_date] || Date.today
        items = payload[:lines] || payload[:receipt_order_lines] || []
        source_name = payload[:source_name] || payload[:name]

        explicit_hub = find_optional_hub(payload[:hub_id])
        warehouse = find_optional_warehouse(warehouse_id)
        if warehouse.blank? && explicit_hub.blank?
          raise ArgumentError, "Select a destination hub or warehouse"
        end

        order = ReceiptOrderCreator.new(
          explicit_hub: explicit_hub,
          warehouse: warehouse,
          received_date: received_date,
          created_by: current_user,
          items: items,
          source: PolymorphicReferenceResolver.resolve_source(payload[:source_type], payload[:source_id]),
          reference_no: payload[:reference_no],
          description: payload[:description] || payload[:notes],
          name: source_name,
          location_id: location_attrs[:location_id],
          hierarchical_level: location_attrs[:hierarchical_level]
        ).call

        # Reload with proper associations
        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order, status: :created)
      end

      def update
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [ :commodity, :unit ]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be updated" unless order.status_draft?

        ReceiptOrder.transaction do
          payload = receipt_order_params

          warehouse_attr =
            if payload.key?(:warehouse_id) || payload.key?(:destination_warehouse_id)
              wid = payload[:destination_warehouse_id].presence || payload[:warehouse_id].presence
              wid.present? ? find_optional_warehouse(wid) : nil
            else
              order.warehouse
            end

          received_attr =
            if payload.key?(:received_date) || payload.key?(:expected_delivery_date)
              payload[:expected_delivery_date].presence || payload[:received_date] || order.received_date
            else
              order.received_date
            end

          source_attr =
            if payload.key?(:source_type) || payload.key?(:source_id)
              st = payload[:source_type].to_s.presence
              sid = payload[:source_id]
              if st.present? && sid.present?
                PolymorphicReferenceResolver.resolve_source(st, sid)
              elsif payload.key?(:source_id) && sid.blank?
                nil
              else
                order.source
              end
            else
              order.source
            end

          description_attr =
            if payload.key?(:description) || payload.key?(:notes)
              payload[:notes].presence || payload[:description].presence || order.description
            else
              order.description
            end

          name_attr =
            if payload.key?(:name) || payload.key?(:source_name)
              payload[:source_name].presence || payload[:name].presence || order.name
            else
              order.name
            end

          warehouse_changed = payload.key?(:warehouse_id) || payload.key?(:destination_warehouse_id)
          resolved_hub =
            if payload.key?(:hub_id) || warehouse_changed
              ReceiptOrderHubResolver.call(
                explicit_hub: payload.key?(:hub_id) ? find_optional_hub(payload[:hub_id]) : nil,
                warehouse: warehouse_attr
              )
            else
              order.hub
            end

          order.assign_attributes(
            hub: resolved_hub,
            warehouse: warehouse_attr,
            received_date: received_attr,
            source: source_attr,
            reference_no: payload.key?(:reference_no) ? payload[:reference_no].presence : order.reference_no,
            description: description_attr,
            name: name_attr
          )
          order.save!

          if payload.key?(:receipt_order_lines) || payload.key?(:lines)
            replace_receipt_order_lines!(order, payload[:receipt_order_lines].presence || payload[:lines] || [])
          end
        end

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def destroy
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity]).find(params[:id])
        authorize order

        raise ArgumentError, "Only draft receipt orders can be deleted" unless order.status_draft?

        destroyed_id = order.id
        order.destroy!
        render_success({ id: destroyed_id })
      end

      def confirm
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity]).find(params[:id])
        authorize order

        # Validate batch quantities before confirming
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          if line.quantity.to_f > commodity.quantity.to_f
            raise ArgumentError, "Insufficient batch quantity for #{commodity.name || commodity.batch_no}. Available: #{commodity.quantity}, Requested: #{line.quantity}"
          end
        end

        ReceiptOrderConfirmer.new(order: order, confirmed_by: current_user).call

        # Deduct batch quantities on confirm
        order.reload
        deduct_batch_quantities(order)

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def assignable_managers
        order = policy_scope(ReceiptOrder).includes(:hub, warehouse: :hub).find(params[:id])
        authorize order, :assignable_managers?

        effective_hub_id = order.warehouse&.hub_id.presence || order.hub_id
        manager_only = params[:manager_only] == 'true'
        
        # CRITICAL: Filter by active warehouse context for multi-warehouse managers
        active_warehouse_id = params[:warehouse_id].present? ? params[:warehouse_id].to_i : nil

        if effective_hub_id.present?
          managers = manager_only ? receipt_order_managers_for_hub_managers_only(effective_hub_id) : receipt_order_managers_for_hub(effective_hub_id)
          
          # CRITICAL: If warehouse_id param is provided, only return stores from that warehouse
          if active_warehouse_id.present?
            stores = manager_only ? [] : available_stores_for_warehouse(active_warehouse_id)
          else
            stores = manager_only ? [] : available_stores_for_hub(effective_hub_id)
          end
          
          hub = Hub.find_by(id: effective_hub_id)
          return render_success(
            assignable_managers: managers,
            stores: stores,
            hub_id: effective_hub_id,
            hub_name: hub&.name,
            warehouse_id: order.warehouse_id,
            warehouse_name: order.warehouse&.name,
            managers_scope: "hub"
          )
        end

        if order.warehouse_id.present?
          managers = manager_only ? receipt_order_managers_for_standalone_warehouse_managers_only(order.warehouse_id) : receipt_order_managers_for_standalone_warehouse(order.warehouse_id)
          stores = manager_only ? [] : available_stores_for_warehouse(order.warehouse_id)
          return render_success(
            assignable_managers: managers,
            stores: stores,
            hub_id: nil,
            hub_name: nil,
            warehouse_id: order.warehouse_id,
            warehouse_name: order.warehouse&.name,
            managers_scope: "warehouse"
          )
        end

        render_success(
          assignable_managers: [],
          stores: [],
          hub_id: nil,
          hub_name: nil,
          warehouse_id: nil,
          warehouse_name: nil,
          managers_scope: nil
        )
      end

      def assign
        order = policy_scope(ReceiptOrder).includes(warehouse: :hub).find(params[:id])
        authorize order, :assign?

        ReceiptOrderAssignmentService.new(
          order: order,
          actor: current_user,
          assignments: assignment_params[:assignments]
        ).call

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
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

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def workflow
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :workflow?

        render_success(
          workflow_events: ActiveModelSerializers::SerializableResource.new(
            order.workflow_events.includes(:actor).order(occurred_at: :asc, id: :asc),
            each_serializer: WorkflowEventSerializer
          ).as_json
        )
      end

      def start_stacking
        order = policy_scope(ReceiptOrder).find(params[:id])
        authorize order, :start_stacking?

        allowed_statuses = %w[confirmed assigned reserved in_progress]
        unless allowed_statuses.include?(order.status.to_s.downcase)
          raise ArgumentError, "Cannot start stacking — order must be confirmed or assigned (current: #{order.status})"
        end

        old_status = order.status
        order.update!(status: "in_progress")
        WorkflowEventRecorder.record!(
          entity: order,
          event_type: "receipt_order.stacking_started",
          actor: current_user,
          from_status: old_status,
          to_status: order.status
        )

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      def finish_stacking
        order = policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity, :unit]).find(params[:id])
        authorize order, :finish_stacking?

        unless order.status.to_s.downcase == "in_progress"
          raise ArgumentError, "Cannot finish stacking — order must be in progress (current: #{order.status})"
        end

        placements = Array(params[:placements])
        raise ArgumentError, "Please add at least one stack placement before finishing." if placements.empty?

        # Use quantity_received from inspections if available, otherwise fall back to ordered quantity
        total_received = Inspection
          .joins(:inspection_items)
          .where(receipt_order: order)
          .sum("cats_warehouse_inspection_items.quantity_received")
        total_to_stack = total_received > 0 ? total_received : order.receipt_order_lines.sum { |l| l.quantity.to_f }
        total_stacked = placements.sum { |p| p[:quantity].to_f }

        if (total_stacked - total_to_stack).abs > 0.001
          raise ArgumentError, "Total stacked (#{total_stacked.round(2)}) does not match total received (#{total_to_stack.round(2)}). Please adjust your stack placements."
        end

        first_line = order.receipt_order_lines.first
        warehouse_id = order.warehouse_id || order.receipt_order_assignments
          .joins(:store)
          .where.not(store_id: nil)
          .pick("cats_warehouse_stores.warehouse_id")

        raise ArgumentError, "Cannot determine warehouse for this order. Ensure it is assigned to a store." unless warehouse_id

        ReceiptOrder.transaction do
          # Auto-create GRN with stack placements
          grn = Grn.create!(
            warehouse_id: warehouse_id,
            received_on: Date.today,
            received_by: current_user,
            receipt_order: order,
            status: "draft"
          )

          placements.each do |placement|
            stack = Stack.find(placement[:stack_id].to_i)
            grn.grn_items.create!(
              commodity_id: first_line.commodity_id,
              quantity: placement[:quantity].to_f,
              unit_id: first_line.unit_id,
              stack_id: stack.id,
              store_id: stack.store_id,
              line_reference_no: SourceDetailReference.generate_unique
            )
          end

          # Confirm GRN — apply inventory ledger entries and update stack quantities
          grn.ensure_confirmable!
          grn.update!(status: :confirmed, approved_by: current_user, workflow_status: "confirmed")
          grn.grn_items.find_each do |item|
            InventoryLedger.apply_receipt!(
              warehouse: grn.warehouse,
              item: item,
              transaction_date: grn.received_on,
              reference: grn
            )
          end
          WorkflowEventRecorder.record!(entity: grn, event_type: "grn.confirmed", actor: current_user, from_status: "draft", to_status: "confirmed")

          order.update!(status: "completed")
          WorkflowEventRecorder.record!(
            entity: order,
            event_type: "receipt_order.stacking_completed",
            actor: current_user,
            from_status: "in_progress",
            to_status: "completed"
          )
        end

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      private

      def order_detail_includes
        [
          :hub,
          :warehouse,
          {
            receipt_order_lines: [ :commodity, :unit ],
            receipt_order_assignments: [ :assigned_to, :assigned_by, :hub, :warehouse, :store ],
            space_reservations: [ :warehouse, :store, :reserved_by ]
          }
        ]
      end

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
            :line_reference_no,
            :notes,
            :packaging_unit_id,
            :packaging_size
          ],
          lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :line_reference_no,
            :notes,
            :packaging_unit_id,
            :packaging_size
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

      # Hub-scoped receipt orders: includes Hub Managers, Warehouse Managers, and Storekeepers for the hub.
      def receipt_order_managers_for_hub(hub_id)
        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)

        hub_manager_ids = UserAssignment.where(role_name: "Hub Manager", hub_id: hub_id).distinct.pluck(:user_id)
        warehouse_manager_ids = UserAssignment
          .where(role_name: "Warehouse Manager")
          .where(warehouse_id: warehouse_ids)
          .distinct
          .pluck(:user_id)
        storekeeper_ids = UserAssignment
          .where(role_name: "Storekeeper")
          .where(store_id: Store.where(warehouse_id: warehouse_ids).select(:id))
          .distinct
          .pluck(:user_id)

        all_user_ids = hub_manager_ids + warehouse_manager_ids + storekeeper_ids
        map_users_for_assignable_managers(all_user_ids)
      end

      # Hub-scoped: only Hub Managers and Warehouse Managers (for officer assignment)
      def receipt_order_managers_for_hub_managers_only(hub_id)
        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)

        hub_manager_ids = UserAssignment.where(role_name: "Hub Manager", hub_id: hub_id).distinct.pluck(:user_id)
        warehouse_manager_ids = UserAssignment
          .where(role_name: "Warehouse Manager")
          .where(warehouse_id: warehouse_ids)
          .distinct
          .pluck(:user_id)

        all_user_ids = hub_manager_ids + warehouse_manager_ids
        map_users_for_assignable_managers(all_user_ids)
      end

      def receipt_order_managers_for_standalone_warehouse(warehouse_id)
        warehouse_ids = [ warehouse_id ]
        warehouse_manager_ids = UserAssignment.where(role_name: "Warehouse Manager", warehouse_id: warehouse_id).distinct.pluck(:user_id)
        storekeeper_ids = UserAssignment
          .where(role_name: "Storekeeper")
          .where(store_id: Store.where(warehouse_id: warehouse_ids).select(:id))
          .distinct
          .pluck(:user_id)

        all_user_ids = warehouse_manager_ids + storekeeper_ids
        map_users_for_assignable_managers(all_user_ids)
      end

      # Standalone warehouse: only Warehouse Managers (for officer assignment)
      def receipt_order_managers_for_standalone_warehouse_managers_only(warehouse_id)
        warehouse_manager_ids = UserAssignment.where(role_name: "Warehouse Manager", warehouse_id: warehouse_id).distinct.pluck(:user_id)
        map_users_for_assignable_managers(warehouse_manager_ids)
      end

      def available_stores_for_hub(hub_id)
        warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)
        Store.where(warehouse_id: warehouse_ids)
          .order(:name)
          .map { |s| { id: s.id, name: s.name, code: s.code, warehouse_id: s.warehouse_id } }
      end

      def available_stores_for_warehouse(warehouse_id)
        Store.where(warehouse_id: warehouse_id)
          .order(:name)
          .map { |s| { id: s.id, name: s.name, code: s.code, warehouse_id: s.warehouse_id } }
      end

      def map_users_for_assignable_managers(user_ids)
        return [] if user_ids.empty?

        mod_id = warehouse_module.id
        assignments = UserAssignment
          .where(user_id: user_ids)
          .includes(:user)
          .distinct

        result = []
        assignments.each do |assignment|
          next unless assignment.user&.active? && assignment.user.application_module_id == mod_id

          display = [ assignment.user.first_name, assignment.user.last_name ].compact.join(" ").strip
          display = assignment.user.email if display.blank?

          user_info = {
            id: assignment.user.id,
            name: display,
            role: assignment.role_name
          }

          case assignment.role_name
          when "Storekeeper"
            user_info[:store_id] = assignment.store_id
            user_info[:store_name] = assignment.store&.name
          when "Warehouse Manager"
            user_info[:warehouse_id] = assignment.warehouse_id
            user_info[:warehouse_name] = assignment.warehouse&.name
          when "Hub Manager"
            user_info[:hub_id] = assignment.hub_id
            user_info[:hub_name] = assignment.hub&.name
          end

          result << user_info
        end
        result.sort_by { |u| [ u[:name], u[:id] ] }
      end

      def find_optional_hub(id)
        id.present? ? Hub.find(id) : nil
      end

      def find_optional_warehouse(id)
        id.present? ? Warehouse.find(id) : nil
      end

      def replace_receipt_order_lines!(order, items)
        order.receipt_order_lines.destroy_all

        Array(items).each do |raw|
          order.receipt_order_lines.create!(ReceiptOrderLine.attributes_from_line_payload(raw))
        end
      end

      # Deduct commodity quantities when a receipt order is created
      def deduct_batch_quantities(order)
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          new_qty = commodity.quantity.to_f - line.quantity.to_f
          commodity.update_column(:quantity, [new_qty, 0].max)
        end
      end

      # Restore commodity quantities when a receipt order is deleted
      def restore_batch_quantities(order)
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          commodity.update_column(:quantity, commodity.quantity.to_f + line.quantity.to_f)
        end
      end
    end
  end
end
