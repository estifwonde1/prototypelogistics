module Cats
  module Warehouse
    class StorekeeperAssignmentsController < BaseController
      skip_after_action :verify_authorized

      def index
        dashboard_data
      end

      def accept
        assignment = find_assignment

        assignment.update!(status: "accepted")

        render_success(
          assignment: StorekeeperAssignmentSerializer.new(assignment).as_json
        )
      end

      def search_delivery
        reference_no = params[:reference_no]&.strip
        explicit_warehouse_id = params[:warehouse_id]&.to_i.presence
        explicit_store_id = params[:store_id]&.to_i.presence

        # Resolve accessible warehouse and store IDs based on user role
        scope = resolve_accessible_ids(explicit_warehouse_id, explicit_store_id)
        wh_ids = scope[:warehouse_ids]
        st_ids = scope[:store_ids]
        is_unrestricted = scope[:unrestricted]

        # Search across different document types
        results = []

        # ── Receipt Orders ──
        receipt_order_scope = ReceiptOrder
          .joins(:receipt_order_assignments)
          .includes(:warehouse, :hub, :created_by, :receipt_order_lines, :receipt_order_assignments)

        unless is_unrestricted
          receipt_order_scope = apply_assignment_scope(
            receipt_order_scope, wh_ids, st_ids,
            table: "cats_warehouse_receipt_order_assignments"
          )
        end

        receipt_order_scope = receipt_order_scope.distinct

        if reference_no.blank?
          receipt_orders = receipt_order_scope
            .where(status: ['assigned', 'in_progress'])
            .order(updated_at: :desc)
            .limit(10)
        else
          sanitized_ref = sanitize_like_input(reference_no)
          ro_id = reference_no.match(/^RO-?(\d+)$/i)&.captures&.first&.to_i

          receipt_orders = if ro_id.present?
            receipt_order_scope.where(
              "cats_warehouse_receipt_orders.reference_no ILIKE ? OR cats_warehouse_receipt_orders.id = ?",
              "%#{sanitized_ref}%", ro_id
            ).limit(5)
          else
            receipt_order_scope.where(
              "cats_warehouse_receipt_orders.reference_no ILIKE ?",
              "%#{sanitized_ref}%"
            ).limit(5)
          end
        end

        seen_ids = Set.new
        receipt_orders.each do |order|
          next if seen_ids.include?(order.id)
          seen_ids.add(order.id)
          commodity_names = order.receipt_order_lines.map { |l|
            commodity = Cats::Core::Commodity.find_by(id: l.commodity_id)
            commodity&.read_attribute(:name).presence || commodity&.batch_no || "Commodity ##{l.commodity_id}"
          }.uniq.join(", ")

          # CRITICAL: Calculate quantity based on assignments to THIS storekeeper's warehouse/store
          # Get assignments that are relevant to this storekeeper
          relevant_assignments = order.receipt_order_assignments.select do |a|
            if is_unrestricted
              true
            elsif st_ids.present?
              # Storekeeper: ONLY store-level assignments for their stores
              st_ids.include?(a.store_id)
            elsif wh_ids.present?
              # Warehouse manager: warehouse-level (no store_id) OR store-level for their warehouse
              wh_ids.include?(a.warehouse_id)
            else
              false
            end
          end
          
          next if relevant_assignments.empty?

          # Calculate total quantity from relevant assignments
          total_qty = relevant_assignments.sum { |a| a.quantity.to_f }

          first_line = order.receipt_order_lines.first
          unit_name = first_line ? Cats::Core::UnitOfMeasure.find_by(id: first_line.unit_id)&.abbreviation : nil
          created_by = order.created_by
          created_by_name = created_by ? [created_by.first_name, created_by.last_name].compact.join(" ").presence || created_by.email : nil

          # Build per-line details for stack configuration auto-fill
          # Use quantities from relevant assignments, not the original line quantities
          lines_data = order.receipt_order_lines.filter_map { |l|
            # Find assignments for this specific line
            line_assignments = relevant_assignments.select { |a| a.receipt_order_line_id == l.id }
            
            # Calculate quantity for this line from assignments
            line_qty = if line_assignments.any?
              line_assignments.sum { |a| a.quantity.to_f }
            elsif relevant_assignments.first.receipt_order_line_id.nil?
              # Order-level assignment, use the assigned quantity
              relevant_assignments.first.quantity.to_f
            else
              0
            end

            next if line_qty <= 0
            
            commodity = Cats::Core::Commodity.find_by(id: l.commodity_id)
            unit = Cats::Core::UnitOfMeasure.find_by(id: l.unit_id)
            {
              commodity_id: l.commodity_id,
              commodity_name: commodity&.read_attribute(:name).presence || commodity&.batch_no || "Commodity ##{l.commodity_id}",
              batch_no: commodity&.batch_no.presence || l.line_reference_no,
              quantity: line_qty,
              unit_id: l.unit_id,
              unit_name: unit&.name,
              unit_abbreviation: unit&.abbreviation
            }
          }

          first_commodity = first_line ? Cats::Core::Commodity.find_by(id: first_line.commodity_id) : nil

          # Always use RO-{id} format for immediate recognition
          display_ref = "RO-#{order.id}"

          results << {
            type: "Receipt Order",
            reference_no: display_ref,
            commodity: commodity_names,
            quantity: total_qty,
            unit: unit_name,
            batch_no: first_commodity&.batch_no.presence || first_line&.line_reference_no,
            commodity_id: first_line&.commodity_id,
            unit_id: first_line&.unit_id,
            lines: lines_data,
            source_location: order.warehouse&.name || order.hub&.name,
            expected_date: order.received_date,
            created_by: created_by_name,
            status: order.status.to_s.downcase,
            id: order.id,
            can_start_receipt: %w[confirmed assigned].include?(order.status.to_s.downcase)
          }
        end

        if reference_no.present?
          sanitized_ref ||= sanitize_like_input(reference_no)

          # ── Dispatch Orders ──
          dispatch_scope = DispatchOrder
            .where("reference_no ILIKE ?", "%#{sanitized_ref}%")
            .joins(:dispatch_order_assignments)
            .includes(:warehouse, :hub, :created_by, :dispatch_order_lines)

          unless is_unrestricted
            dispatch_scope = apply_assignment_scope(
              dispatch_scope, wh_ids, st_ids,
              table: "cats_warehouse_dispatch_order_assignments"
            )
          end

          dispatch_scope.distinct.limit(5).each do |order|
            results << {
              type: "Dispatch Order",
              reference_no: order.reference_no,
              commodity: order.dispatch_order_lines.map(&:commodity_name).join(", "),
              quantity: order.dispatch_order_lines.sum(&:quantity),
              unit: order.dispatch_order_lines.first&.unit_name,
              source_location: order.warehouse&.name || order.hub&.name,
              expected_date: order.dispatched_date,
              created_by: order.created_by&.name,
              status: order.status,
              id: order.id,
              can_start_receipt: false
            }
          end

          # ── Waybills ──
          if defined?(Waybill)
            Waybill
              .where("reference_no ILIKE ?", "%#{sanitized_ref}%")
              .includes(:dispatch_order)
              .limit(5).each do |waybill|
              next unless waybill.dispatch_order

              results << {
                type: "Waybill",
                reference_no: waybill.reference_no,
                commodity: waybill.dispatch_order.dispatch_order_lines.map(&:commodity_name).join(", "),
                quantity: waybill.dispatch_order.dispatch_order_lines.sum(&:quantity),
                unit: waybill.dispatch_order.dispatch_order_lines.first&.unit_name,
                source_location: waybill.dispatch_order.warehouse&.name || waybill.dispatch_order.hub&.name,
                expected_date: waybill.dispatch_order.dispatched_date,
                created_by: waybill.respond_to?(:created_by) ? waybill.created_by&.name : nil,
                status: waybill.status,
                id: waybill.id,
                can_start_receipt: false
              }
            end
          end
        end

        if results.empty?
          render_success(
            results: [],
            message: "No expected delivery found for reference number '#{reference_no}'. Please check the reference and try again."
          )
        else
          render_success(
            results: results,
            message: "Found #{results.length} delivery(s) matching '#{reference_no}'"
          )
        end
      end

      def dashboard_data
        current_ids = current_store_ids

        # CRITICAL: Storekeepers should only see store-level assignments
        # The where(store_id: current_ids) already filters to only assignments
        # where store_id is set and matches their store
        receipt_assignments = ReceiptOrderAssignment
          .where(store_id: current_ids)
          .includes(
            :receipt_order, 
            :store, 
            :warehouse, 
            :hub, 
            :assigned_to, 
            :assigned_by,
            receipt_order_line: [:commodity, :unit]
          )
          .order(created_at: :desc)

        dispatch_assignments = DispatchOrderAssignment
          .where(store_id: current_ids)
          .includes(:dispatch_order, :store, :warehouse, :hub, :assigned_to, :assigned_by)
          .order(created_at: :desc)

        # Get recent completed transactions (GRNs and GINs)
        warehouse_ids = Cats::Warehouse::Store.where(id: current_ids).pluck(:warehouse_id).compact

        recent_grns = begin
          Grn
            .where(warehouse_id: warehouse_ids)
            .where(status: "confirmed")
            .includes(:receipt_order, :received_by)
            .order(created_at: :desc)
            .limit(5)
        rescue StandardError
          []
        end

        recent_gins = begin
          Gin
            .where(warehouse_id: warehouse_ids)
            .where(status: "confirmed")
            .includes(:dispatch_order, :issued_by)
            .order(created_at: :desc)
            .limit(5)
        rescue StandardError
          []
        end

        completed_transactions = []
        
        recent_grns.each do |grn|
          completed_transactions << {
            type: "Receipt",
            reference_no: grn.reference_no,
            order_reference: grn.receipt_order&.reference_no,
            completed_at: grn.updated_at,
            completed_by: [grn.received_by&.first_name, grn.received_by&.last_name].compact.join(" ").presence || grn.received_by&.email,
            status: grn.status
          }
        end
        
        recent_gins.each do |gin|
          completed_transactions << {
            type: "Dispatch",
            reference_no: gin.reference_no,
            order_reference: gin.dispatch_order&.reference_no,
            completed_at: gin.updated_at,
            completed_by: [gin.issued_by&.first_name, gin.issued_by&.last_name].compact.join(" ").presence || gin.issued_by&.email,
            status: gin.status
          }
        end
        
        completed_transactions.sort_by! { |t| t[:completed_at] }.reverse!

        activity = WorkflowEvent
          .where(actor_id: current_user.id)
          .limit(10)
          .order(occurred_at: :desc)

        render_success(
          receipt_assignments: ActiveModelSerializers::SerializableResource.new(
            receipt_assignments,
            each_serializer: StorekeeperAssignmentSerializer
          ).as_json,
          dispatch_assignments: ActiveModelSerializers::SerializableResource.new(
            dispatch_assignments,
            each_serializer: DispatchOrderAssignmentSerializer
          ).as_json,
          completed_transactions: completed_transactions,
          activity: ActiveModelSerializers::SerializableResource.new(
            activity,
            each_serializer: WorkflowEventSerializer
          ).as_json
        )
      end

      private

      def find_assignment
        ReceiptOrderAssignment
          .where(store_id: current_store_ids)
          .find(params[:id])
      end

      def current_store_ids
        access = AccessContext.new(user: current_user)
        access.assigned_store_ids
      end

      # Resolve accessible warehouse and store IDs based on user role.
      # Returns { warehouse_ids: [...], store_ids: [...], unrestricted: bool }
      def resolve_accessible_ids(explicit_warehouse_id = nil, explicit_store_id = nil)
        if explicit_store_id.present?
          wh_id = Store.where(id: explicit_store_id).pluck(:warehouse_id).first
          return { warehouse_ids: [wh_id].compact, store_ids: [explicit_store_id], unrestricted: false }
        elsif explicit_warehouse_id.present?
          st_ids = Store.where(warehouse_id: explicit_warehouse_id).pluck(:id)
          return { warehouse_ids: [explicit_warehouse_id], store_ids: st_ids, unrestricted: false }
        end

        access = AccessContext.new(user: current_user)

        if access.admin?
          { warehouse_ids: [], store_ids: [], unrestricted: true }
        elsif access.hub_manager?
          hub_ids = access.assigned_hub_ids
          w_ids = Warehouse.where(hub_id: hub_ids).pluck(:id)
          s_ids = Store.where(warehouse_id: w_ids).pluck(:id)
          { warehouse_ids: w_ids, store_ids: s_ids, unrestricted: false }
        elsif access.warehouse_manager?
          w_ids = access.assigned_warehouse_ids
          s_ids = Store.where(warehouse_id: w_ids).pluck(:id)
          { warehouse_ids: w_ids, store_ids: s_ids, unrestricted: false }
        elsif access.storekeeper?
          s_ids = access.assigned_store_ids
          w_ids = Store.where(id: s_ids).pluck(:warehouse_id).compact.uniq
          { warehouse_ids: w_ids, store_ids: s_ids, unrestricted: false }
        else
          { warehouse_ids: [], store_ids: [], unrestricted: false }
        end
      end

      # Apply warehouse_id / store_id filter to an assignment-joined scope.
      # table: the assignment table name, e.g. "cats_warehouse_receipt_order_assignments"
      def apply_assignment_scope(scope, wh_ids, st_ids, table:)
        conditions = []
        values = {}

        if wh_ids.present?
          conditions << "#{table}.warehouse_id IN (:wh_ids)"
          values[:wh_ids] = wh_ids
        end

        if st_ids.present?
          conditions << "#{table}.store_id IN (:st_ids)"
          values[:st_ids] = st_ids
        end

        if conditions.any?
          scope.where(conditions.join(" OR "), values)
        else
          scope.none
        end
      end

      # Sanitize input for LIKE queries to prevent SQL injection
      def sanitize_like_input(input)
        # Escape SQL LIKE wildcards and backslashes
        input.gsub(/[%_\\]/, '\\\\\&')
      end
    end
  end
end
