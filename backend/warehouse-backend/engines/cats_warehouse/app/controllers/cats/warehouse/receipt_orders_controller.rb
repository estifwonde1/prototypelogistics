module Cats
  module Warehouse
    class ReceiptOrdersController < BaseController
      def index
        authorize ReceiptOrder
        
        # CRITICAL: For warehouse managers with warehouse_id parameter, we need to filter
        # BEFORE policy_scope to ensure we only get orders for the active warehouse
        if params[:warehouse_id].present?
          warehouse_id = params[:warehouse_id].to_i
          
          # Verify user has access to this warehouse
          access = AccessContext.new(user: current_user)
          unless access.can_access_warehouse?(warehouse_id)
            return render_error("Access denied to warehouse #{warehouse_id}", status: :forbidden)
          end
          
          orders = WarehouseReceiptOrderScope
            .relation_for_warehouse(warehouse_id: warehouse_id)
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

        viewer_wh = params[:warehouse_id].presence&.to_i
        viewer_hub = params[:hub_id].presence&.to_i

        if viewer_hub.present? && viewer_hub.positive?
          access = AccessContext.new(user: current_user)
          unless access.can_access_hub?(viewer_hub)
            return render_error("Access denied to hub #{viewer_hub}", status: :forbidden)
          end
        end

        payload = ActiveModelSerializers::SerializableResource.new(
          orders,
          each_serializer: ReceiptOrderSerializer,
          scope: current_user,
          scope_name: :current_user,
          viewer_warehouse_id: viewer_wh.to_i.positive? ? viewer_wh : nil,
          viewer_hub_id: viewer_hub.to_i.positive? ? viewer_hub : nil
        ).as_json
        render_success(payload)
      end

      def show
        order = policy_scope(ReceiptOrder).includes(:hub, :warehouse).find(params[:id])
        authorize order
        ensure_order_in_requested_warehouse!(order)

        assignments = order.receipt_order_assignments
          .includes(:assigned_to, :assigned_by, :store, :warehouse, :hub, { receipt_order_line: :unit })

        # Debug: Log assignment details and user role
        Rails.logger.info "DEBUG: User #{current_user.id} role check - Hub Manager: #{hub_manager?}, Warehouse Manager: #{warehouse_manager?}, Officer: #{officer?}"
        Rails.logger.info "DEBUG: Found #{assignments.count} total assignments before filtering"
        assignments.each_with_index do |assignment, index|
          Rails.logger.info "DEBUG: Assignment #{index + 1}: ID=#{assignment.id}, Hub=#{assignment.hub_id} (#{assignment.hub&.name}), Warehouse=#{assignment.warehouse_id} (#{assignment.warehouse&.name}), Quantity=#{assignment.quantity}"
        end

        # Only apply role-based filtering for non-officers to maintain visibility of all assignments
        # Officers need to see all assignments to get the complete picture of commodity classification
        # This ensures that when commodities are classified to different destinations, all locations
        # are visible in the assignment tab of the receipt order details page
        unless officer?
          if hub_manager?
            # Hub managers should only see assignments to their specific hub(s)
            hub_ids = UserAssignment.where(user: current_user, role_name: "Hub Manager").pluck(:hub_id).compact
            Rails.logger.info "DEBUG: Hub Manager - User's hub IDs: #{hub_ids}"
            assignments = assignments.where(hub_id: hub_ids.presence || [0])
            Rails.logger.info "DEBUG: After hub filtering: #{assignments.count} assignments"
          elsif warehouse_manager?
          if params[:warehouse_id].present?
            active_warehouse_id = params[:warehouse_id].to_i
            assignments = ReceiptOrderViewerScope
              .assignments_for(order, warehouse_id: active_warehouse_id)
              .includes(:assigned_to, :assigned_by, :store, :warehouse, :hub, { receipt_order_line: :unit })
          else
            wh_ids = UserAssignment.where(user: current_user, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
            store_ids = Cats::Warehouse::Store.where(warehouse_id: wh_ids).pluck(:id)
            assignments = assignments.where(
              "cats_warehouse_receipt_order_assignments.warehouse_id IN (?) OR cats_warehouse_receipt_order_assignments.store_id IN (?)",
              wh_ids.presence || [0],
              store_ids.presence || [0]
            )
          end
          elsif storekeeper?
            # Storekeepers should only see assignments to their specific store(s)
            store_ids = UserAssignment.where(user: current_user, role_name: "Storekeeper").pluck(:store_id).compact
            Rails.logger.info "DEBUG: Storekeeper - User's store IDs: #{store_ids}"
            assignments = assignments.where(store_id: store_ids.presence || [0])
            Rails.logger.info "DEBUG: After store filtering: #{assignments.count} assignments"
          end
        else
          Rails.logger.info "DEBUG: Officer - No filtering applied, showing all assignments"
        end

        Rails.logger.info "DEBUG: Final assignments count: #{assignments.count}"
        assignments.each_with_index do |assignment, index|
          Rails.logger.info "DEBUG: Final Assignment #{index + 1}: ID=#{assignment.id}, Hub=#{assignment.hub_id} (#{assignment.hub&.name}), Warehouse=#{assignment.warehouse_id} (#{assignment.warehouse&.name}), Quantity=#{assignment.quantity}"
        end

        serialized = ReceiptOrderSerializer.new(
          order,
          viewer_warehouse_id: params[:warehouse_id].presence&.to_i
        ).as_json
        serialized[:receipt_order_assignments] = ActiveModelSerializers::SerializableResource.new(
          assignments,
          each_serializer: ReceiptOrderAssignmentSerializer
        ).as_json

        # For storekeepers: also scope receipt_order_lines to only the lines they have assignments for.
        # The serializer always includes all lines; we override here so the storekeeper never sees
        # the full hub quantity — only the lines (and quantities) assigned to their store.
        if storekeeper?
          store_ids = UserAssignment.where(user: current_user, role_name: "Storekeeper").pluck(:store_id).compact
          assigned_line_ids = ReceiptOrderAssignment
            .where(receipt_order: order, store_id: store_ids)
            .where.not(receipt_order_line_id: nil)
            .pluck(:receipt_order_line_id)
            .uniq

          scoped_lines = if assigned_line_ids.any?
            order.receipt_order_lines.select { |l| assigned_line_ids.include?(l.id) }
          else
            # No line-level assignment — storekeeper still needs to see the lines
            # but quantity should be capped to their store assignment quantity.
            # Return all lines; the frontend will use assignment.quantity as the ceiling.
            order.receipt_order_lines.to_a
          end

          serialized[:receipt_order_lines] = ActiveModelSerializers::SerializableResource.new(
            scoped_lines,
            each_serializer: ReceiptOrderLineSerializer
          ).as_json
        elsif warehouse_manager? && params[:warehouse_id].present?
          scoped_lines = ReceiptOrderViewerScope.lines_for(
            order,
            warehouse_id: params[:warehouse_id],
            assignments: assignments
          )
          serialized[:receipt_order_lines] = ActiveModelSerializers::SerializableResource.new(
            scoped_lines,
            each_serializer: ReceiptOrderLineSerializer
          ).as_json
        end

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

          converted_qty = Cats::Warehouse::UomConversionResolver.convert(
            line.quantity.to_f,
            from_unit_id: line.unit_id,
            to_unit_id: commodity.unit_of_measure_id,
            commodity_id: commodity.id
          )

          if converted_qty > commodity.quantity.to_f
            raise ArgumentError, "Insufficient batch quantity for #{commodity.name || commodity.batch_no}. Available: #{commodity.quantity}, Requested: #{converted_qty} (converted)"
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
        ensure_order_in_requested_warehouse!(order)

        effective_hub_id = order.warehouse&.hub_id.presence || order.hub_id
        manager_only = params[:manager_only] == 'true'
        
        # CRITICAL: Filter by active warehouse context for multi-warehouse managers
        active_warehouse_id = params[:warehouse_id].present? ? params[:warehouse_id].to_i : nil

        Rails.logger.info "=== DEBUG assignable_managers ==="
        Rails.logger.info "order.id: #{order.id}"
        Rails.logger.info "order.warehouse_id: #{order.warehouse_id}"
        Rails.logger.info "order.hub_id: #{order.hub_id}"
        Rails.logger.info "order.warehouse&.hub_id: #{order.warehouse&.hub_id}"
        Rails.logger.info "effective_hub_id: #{effective_hub_id}"
        Rails.logger.info "manager_only: #{manager_only}"
        Rails.logger.info "active_warehouse_id: #{active_warehouse_id}"

        if effective_hub_id.present?
          Rails.logger.info "Taking HUB-SCOPED path"
          # CRITICAL: If warehouse_id param is provided, filter managers and stores by that warehouse
          if active_warehouse_id.present?
            Rails.logger.info "  - Using active_warehouse_id: #{active_warehouse_id}"
            # Get managers for the specific warehouse only
            managers = manager_only ? receipt_order_managers_for_standalone_warehouse_managers_only(active_warehouse_id) : receipt_order_managers_for_standalone_warehouse(active_warehouse_id)
            stores = manager_only ? [] : available_stores_for_warehouse(active_warehouse_id)
          else
            Rails.logger.info "  - Using all warehouses in hub: #{effective_hub_id}"
            # Get managers for all warehouses in the hub
            managers = manager_only ? receipt_order_managers_for_hub_managers_only(effective_hub_id) : receipt_order_managers_for_hub(effective_hub_id)
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

        Rails.logger.info "Taking STANDALONE WAREHOUSE path"
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
        ensure_order_in_requested_warehouse!(order)

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
        order =
          if params[:receipt_authorization_id].present?
            ra = policy_scope(ReceiptAuthorization).find_by(id: params[:receipt_authorization_id])
            raise ActiveRecord::RecordNotFound, "Receipt Authorization not found" unless ra

            ReceiptOrder
              .includes(receipt_order_lines: [:commodity, :unit])
              .find(ra.receipt_order_id)
          else
            policy_scope(ReceiptOrder).includes(receipt_order_lines: [:commodity, :unit]).find(params[:id])
          end
        authorize order, :finish_stacking?

        # Storekeeper RA flow goes straight to finish_stacking without a separate start_stacking call.
        # Align with start_stacking: allow the same pre-states and transition to in_progress here.
        status_key = order.status.to_s.downcase
        allowed_pre_finish = %w[confirmed assigned reserved in_progress]
        unless allowed_pre_finish.include?(status_key)
          raise ArgumentError,
                "Cannot finish stacking — order must be assigned, reserved, confirmed, or in progress (current: #{order.status})"
        end

        if status_key != "in_progress"
          old_status = order.status
          order.update!(status: "in_progress")
          WorkflowEventRecorder.record!(
            entity: order,
            event_type: "receipt_order.stacking_started",
            actor: current_user,
            from_status: old_status,
            to_status: order.status
          )
        end

        placements = Array(params[:placements])
        raise ArgumentError, "Please add at least one stack placement before finishing." if placements.empty?

        # ── RA-based flow (new) ──────────────────────────────────────────────
        if params[:receipt_authorization_id].present?
          ra = order.receipt_authorizations.find_by(id: params[:receipt_authorization_id])
          raise ArgumentError, "Receipt Authorization not found for this order" unless ra
          raise ArgumentError, "Receipt Authorization must be Active to finish stacking" unless ra.active?

          grn = draft_grn_for_finish_stacking(ra)
          raise ArgumentError, "No Draft GRN found for this Receipt Authorization. Complete Driver Confirm first." unless grn
          raise ArgumentError, "GRN must be in Draft status" unless grn.status.to_s.downcase == "draft"

          # Find the inspection linked to this specific GRN (each storekeeper has their own)
          inspection = grn.generated_from_inspection
          # Fall back to any inspection on the RA if the GRN link is missing
          inspection ||= ra.inspections.order(created_at: :desc).first
          total_to_stack = inspection ? inspection.inspection_items.sum(:quantity_received).to_f : ra.authorized_quantity.to_f
          total_stacked = placements.sum { |p| p[:quantity].to_f }

          if (total_stacked - total_to_stack).abs > 0.001
            raise ArgumentError, "Total stacked (#{total_stacked.round(2)}) does not match total received (#{total_to_stack.round(2)}). Please adjust your stack placements."
          end

          first_line = order.receipt_order_lines.first

          # Resolve commodity and UOM from inspection items (most reliable source).
          # entered_unit_id is the unit the storekeeper actually typed (e.g. Kuntal).
          # unit_id is the canonical receipt-order line unit (e.g. MT).
          # Fall back to receipt order line if inspection items don't have it.
          inspection_item        = inspection&.inspection_items&.first
          inspection_commodity_id = inspection_item&.commodity_id
          # Canonical unit for the GRN item (used for ledger math)
          inspection_unit_id     = inspection_item&.entered_unit_id.presence ||
                                   inspection_item&.unit_id.presence
          # The unit the user typed — preserved on the StackTransaction for bin/stock card display
          inspection_entered_unit_id = inspection_item&.entered_unit_id

          ReceiptOrder.transaction do
            # Add stack placement items to the existing Draft GRN
            # Clear any existing items first (in case of retry)
            grn.grn_items.destroy_all

            placements.each do |placement|
              stack = Stack.find(placement[:stack_id].to_i)
              # Use inspection commodity (most reliable) → stack's existing commodity → receipt order line
              commodity_id = inspection_commodity_id.presence ||
                             stack.commodity_id.presence ||
                             first_line&.commodity_id
              unit_id      = inspection_unit_id.presence ||
                             stack.unit_id.presence ||
                             first_line&.unit_id

              # Assign commodity to the stack if it doesn't have one yet
              if stack.commodity_id.blank? && commodity_id.present?
                stack.update_columns(commodity_id: commodity_id, unit_id: unit_id)
              end

              # Mark the stack as active now that goods are being placed in it
              stack.update_columns(stack_status: "active") unless stack.stack_status.to_s.downcase == "active"

              grn.grn_items.create!(
                commodity_id:      commodity_id,
                quantity:          placement[:quantity].to_f,
                unit_id:           unit_id,
                entered_unit_id:   inspection_entered_unit_id.presence || unit_id,
                stack_id:          stack.id,
                store_id:          stack.store_id,
                quality_status:    inspection&.inspection_items&.first&.quality_status || 'Good',
                line_reference_no: SourceDetailReference.generate_unique
              )
            end

            # Confirm GRN — apply inventory ledger entries and update stack quantities
            grn.ensure_confirmable!
            grn.update!(status: :confirmed, approved_by: current_user, workflow_status: "confirmed")
            grn.grn_items.find_each do |item|
              InventoryLedger.apply_receipt!(
                warehouse: grn.warehouse,
                item:      item,
                transaction_date: grn.received_on,
                reference: grn
              )
            end
            WorkflowEventRecorder.record!(
              entity: grn, event_type: "grn.confirmed",
              actor: current_user, from_status: "draft", to_status: "confirmed"
            )

            # Notify Hub Manager / Warehouse Manager that GRN is confirmed (Req 12.3)
            enqueue_notification("receipt_authorization.grn_confirmed",
                                 receipt_authorization_id: ra.id,
                                 grn_id: grn.id,
                                 receipt_order_id: order.id)

            # Close the RA only when every recorded inspection has its current
            # generated GRN confirmed. Stale duplicate draft GRNs from retries
            # must not block closure.
            if ra.reload.generated_inspection_grns_confirmed?
              ra.update!(status: ReceiptAuthorization::CLOSED)
              WorkflowEventRecorder.record!(
                entity:      order,
                event_type:  "receipt_authorization.closed",
                actor:       current_user,
                from_status: order.status,
                to_status:   order.status,
                payload:     { receipt_authorization_id: ra.id }
              )

              # Check if all RAs are closed → complete the order
              ReceiptOrderCompletionChecker.new(receipt_order: order, actor: current_user).call
            end
          end

        # ── Legacy flow (backward compatible — no RA) ────────────────────────
        else
          if order.receipt_authorizations.not_cancelled.exists?
            raise ArgumentError,
                  "This receipt order uses Receipt Authorizations. Finish stacking with receipt_authorization_id set."
          end

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
            grn = Grn.create!(
              warehouse_id: warehouse_id,
              received_on:  Date.today,
              received_by:  current_user,
              receipt_order: order,
              status: "draft"
            )

            placements.each do |placement|
              stack = Stack.find(placement[:stack_id].to_i)
              stack.update_columns(stack_status: "active") unless stack.stack_status.to_s.downcase == "active"
              grn.grn_items.create!(
                commodity_id:      first_line.commodity_id,
                quantity:          placement[:quantity].to_f,
                unit_id:           first_line.unit_id,
                stack_id:          stack.id,
                store_id:          stack.store_id,
                line_reference_no: SourceDetailReference.generate_unique
              )
            end

            grn.ensure_confirmable!
            grn.update!(status: :confirmed, approved_by: current_user, workflow_status: "confirmed")
            grn.grn_items.find_each do |item|
              InventoryLedger.apply_receipt!(
                warehouse: grn.warehouse,
                item:      item,
                transaction_date: grn.received_on,
                reference: grn
              )
            end
            WorkflowEventRecorder.record!(
              entity: grn, event_type: "grn.confirmed",
              actor: current_user, from_status: "draft", to_status: "confirmed"
            )

            order.update!(status: Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:completed])
            WorkflowEventRecorder.record!(
              entity:      order,
              event_type:  "receipt_order.stacking_completed",
              actor:       current_user,
              from_status: "in_progress",
              to_status:   Cats::Warehouse::ContractConstants::DOCUMENT_STATUSES[:completed]
            )
          end
        end

        order = ReceiptOrder.includes(*order_detail_includes).find(order.id)
        render_order_payload(order)
      end

      private

      # Each storekeeper gets their own draft GRN via driver confirm; finish must use theirs, not the latest on the RA.
      def draft_grn_for_finish_stacking(ra)
        inspection = ra.inspections.find_by(inspector_id: current_user.id)
        if inspection&.auto_generated_grn_id.present?
          grn = Grn.find_by(id: inspection.auto_generated_grn_id)
          return grn if grn&.status.to_s.downcase == "draft"
        end

        ra.grns.where(status: "draft").order(created_at: :desc).first
      end

      def order_detail_includes
        [
          :hub,
          :warehouse,
          {
            receipt_order_lines: [ :commodity, :unit ],
            receipt_order_assignments: [ :assigned_to, :assigned_by, :hub, :warehouse, :store, { receipt_order_line: :unit } ],
            space_reservations: [ :warehouse, :store, :reserved_by ]
          }
        ]
      end

      def render_order_payload(order, status: :ok)
        ensure_order_in_requested_warehouse!(order)

        # Apply role-based filtering to assignments
        assignments = order.receipt_order_assignments
          .includes(:assigned_to, :assigned_by, :store, :warehouse, :hub, { receipt_order_line: :unit })

        # Only apply role-based filtering for non-officers to maintain visibility of all assignments
        # Officers need to see all assignments to get the complete picture of commodity classification
        unless officer?
          if hub_manager?
            # Hub managers should only see assignments to their specific hub(s)
            hub_ids = UserAssignment.where(user: current_user, role_name: "Hub Manager").pluck(:hub_id).compact
            assignments = assignments.where(hub_id: hub_ids.presence || [0])
          elsif warehouse_manager?
            if params[:warehouse_id].present?
              active_warehouse_id = params[:warehouse_id].to_i
              assignments = ReceiptOrderViewerScope
                .assignments_for(order, warehouse_id: active_warehouse_id)
                .includes(:assigned_to, :assigned_by, :store, :warehouse, :hub, { receipt_order_line: :unit })
            else
              wh_ids = UserAssignment.where(user: current_user, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
              store_ids = Cats::Warehouse::Store.where(warehouse_id: wh_ids).pluck(:id)
              assignments = assignments.where(
                "cats_warehouse_receipt_order_assignments.warehouse_id IN (?) OR cats_warehouse_receipt_order_assignments.store_id IN (?)",
                wh_ids.presence || [0],
                store_ids.presence || [0]
              )
            end
          elsif storekeeper?
            # Storekeepers should only see assignments to their specific store(s)
            store_ids = UserAssignment.where(user: current_user, role_name: "Storekeeper").pluck(:store_id).compact
            assignments = assignments.where(store_id: store_ids.presence || [0])
          end
        end

        payload = ActiveModelSerializers::SerializableResource.new(
          order,
          serializer: ReceiptOrderSerializer
        ).as_json
        
        # Override assignments with filtered ones
        payload[:receipt_order_assignments] = ActiveModelSerializers::SerializableResource.new(
          assignments,
          each_serializer: ReceiptOrderAssignmentSerializer
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
            :packaging_size,
            :destination_hub_id,
            :destination_warehouse_id
          ],
          lines: [
            :commodity_id,
            :quantity,
            :unit_id,
            :line_reference_no,
            :notes,
            :packaging_unit_id,
            :packaging_size,
            :destination_hub_id,
            :destination_warehouse_id
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

      def ensure_order_in_requested_warehouse!(order)
        return unless params[:warehouse_id].present?

        warehouse_id = params[:warehouse_id].to_i
        access = AccessContext.new(user: current_user)
        unless warehouse_id_values(access.accessible_warehouse_ids).include?(warehouse_id)
          raise Pundit::NotAuthorizedError, "Access denied to warehouse #{warehouse_id}"
        end

        return if order_visible_in_warehouse_context?(order, warehouse_id)

        raise ActiveRecord::RecordNotFound, "Receipt Order not found"
      end

      def order_visible_in_warehouse_context?(order, warehouse_id)
        return true if order.warehouse_id.present? && order.warehouse_id.to_i == warehouse_id

        store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)
        roa_t = ReceiptOrderAssignment.table_name
        assigned_here = ReceiptOrderAssignment
          .where(receipt_order_id: order.id)
          .where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")
          .where(
            "warehouse_id = :warehouse_id OR store_id IN (:store_ids)",
            warehouse_id: warehouse_id,
            store_ids: store_ids.presence || [0]
          )
          .exists?
        return true if assigned_here

        ra_t = ReceiptAuthorization.table_name
        ReceiptAuthorization
          .where(receipt_order_id: order.id, warehouse_id: warehouse_id)
          .where.not("LOWER(TRIM(#{ra_t}.status)) = ?", ReceiptAuthorization::CANCELLED)
          .exists?
      end

      def warehouse_id_values(raw)
        if raw.is_a?(Array)
          raw.map { |v| v.is_a?(Integer) ? v : v.try(:id) }.compact.map(&:to_i)
        else
          raw.pluck(:id).map(&:to_i)
        end
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
        
        # Get storekeepers assigned to specific stores
        store_storekeeper_ids = UserAssignment
          .where(role_name: "Storekeeper")
          .where(store_id: Store.where(warehouse_id: warehouse_ids).select(:id))
          .distinct
          .pluck(:user_id)
        
        # ALSO get storekeepers assigned at warehouse level
        warehouse_storekeeper_ids = UserAssignment
          .where(role_name: "Storekeeper")
          .where(warehouse_id: warehouse_ids)
          .distinct
          .pluck(:user_id)

        all_user_ids = hub_manager_ids + warehouse_manager_ids + store_storekeeper_ids + warehouse_storekeeper_ids
        map_users_for_assignable_managers(all_user_ids.uniq)
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
        
        store_ids = Store.where(warehouse_id: warehouse_ids).pluck(:id)
        Rails.logger.info "=== DEBUG receipt_order_managers_for_standalone_warehouse ==="
        Rails.logger.info "warehouse_id: #{warehouse_id}"
        Rails.logger.info "store_ids: #{store_ids.inspect}"
        
        # Get storekeepers assigned to specific stores in this warehouse
        store_storekeeper_assignments = UserAssignment.where(role_name: "Storekeeper", store_id: store_ids)
        Rails.logger.info "store-level storekeeper_assignments count: #{store_storekeeper_assignments.count}"
        
        # ALSO get storekeepers assigned at warehouse level (they can manage all stores in the warehouse)
        warehouse_storekeeper_assignments = UserAssignment.where(role_name: "Storekeeper", warehouse_id: warehouse_id)
        Rails.logger.info "warehouse-level storekeeper_assignments count: #{warehouse_storekeeper_assignments.count}"
        
        all_storekeeper_assignments = store_storekeeper_assignments + warehouse_storekeeper_assignments
        all_storekeeper_assignments.each do |sa|
          Rails.logger.info "  - UserAssignment: user_id=#{sa.user_id}, store_id=#{sa.store_id}, warehouse_id=#{sa.warehouse_id}, role=#{sa.role_name}"
        end
        
        storekeeper_ids = all_storekeeper_assignments.map(&:user_id).uniq
        Rails.logger.info "storekeeper_ids: #{storekeeper_ids.inspect}"
        Rails.logger.info "warehouse_manager_ids: #{warehouse_manager_ids.inspect}"

        all_user_ids = warehouse_manager_ids + storekeeper_ids
        Rails.logger.info "all_user_ids: #{all_user_ids.inspect}"
        
        result = map_users_for_assignable_managers(all_user_ids)
        Rails.logger.info "final result count: #{result.count}"
        result.each do |r|
          Rails.logger.info "  - Result: #{r.inspect}"
        end
        
        result
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
        Rails.logger.info "=== DEBUG map_users_for_assignable_managers ==="
        Rails.logger.info "user_ids: #{user_ids.inspect}"
        Rails.logger.info "warehouse_module.id: #{mod_id}"
        
        assignments = UserAssignment
          .where(user_id: user_ids)
          .includes(:user, :store)
          .distinct
        
        Rails.logger.info "assignments count: #{assignments.count}"

        result = []
        assignments.each do |assignment|
          user_active = assignment.user&.active?
          user_module_id = assignment.user&.application_module_id
          matches_module = user_module_id == mod_id
          
          Rails.logger.info "  - Assignment: user_id=#{assignment.user_id}, role=#{assignment.role_name}, store_id=#{assignment.store_id}, warehouse_id=#{assignment.warehouse_id}, active=#{user_active}, module_id=#{user_module_id}, matches_module=#{matches_module}"
          
          next unless user_active && matches_module

          display = [ assignment.user.first_name, assignment.user.last_name ].compact.join(" ").strip
          display = assignment.user.email if display.blank?

          user_info = {
            id: assignment.user.id,
            name: display,
            role: assignment.role_name
          }

          case assignment.role_name
          when "Storekeeper"
            # Include both store_id and warehouse_id for storekeepers
            user_info[:store_id] = assignment.store_id
            user_info[:store_name] = assignment.store&.name
            user_info[:warehouse_id] = assignment.warehouse_id if assignment.warehouse_id.present?
          when "Warehouse Manager"
            user_info[:warehouse_id] = assignment.warehouse_id
            user_info[:warehouse_name] = assignment.warehouse&.name
          when "Hub Manager"
            user_info[:hub_id] = assignment.hub_id
            user_info[:hub_name] = assignment.hub&.name
          end

          result << user_info
        end
        
        Rails.logger.info "final result: #{result.inspect}"
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

          converted_qty = Cats::Warehouse::UomConversionResolver.convert(
            line.quantity.to_f,
            from_unit_id: line.unit_id,
            to_unit_id: commodity.unit_of_measure_id,
            commodity_id: commodity.id
          )

          new_qty = commodity.quantity.to_f - converted_qty
          commodity.update_column(:quantity, [new_qty, 0].max)
        end
      end

      # Restore commodity quantities when a receipt order is deleted
      def restore_batch_quantities(order)
        order.receipt_order_lines.each do |line|
          next if line.commodity_id.blank? || line.quantity.to_f <= 0

          commodity = Cats::Core::Commodity.find_by(id: line.commodity_id)
          next unless commodity

          converted_qty = Cats::Warehouse::UomConversionResolver.convert(
            line.quantity.to_f,
            from_unit_id: line.unit_id,
            to_unit_id: commodity.unit_of_measure_id,
            commodity_id: commodity.id
          )

          commodity.update_column(:quantity, commodity.quantity.to_f + converted_qty)
        end
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
