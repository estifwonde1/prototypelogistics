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
        
        current_ids = current_store_ids
        
        # Search across different document types
        results = []
        
        receipt_order_scope = ReceiptOrder
          .joins(:receipt_order_assignments)
          .where(receipt_order_assignments: { store_id: current_ids })
          .includes(:warehouse, :hub, :created_by, :receipt_order_lines)

        if reference_no.blank?
          receipt_orders = receipt_order_scope
            .where(status: ['assigned', 'in_progress'])
            .order(updated_at: :desc)
            .limit(10)
        else
          # Sanitize input to prevent SQL injection
          sanitized_ref = sanitize_like_input(reference_no)
          
          # Search Receipt Orders by reference_no OR by RO-{id} pattern
          ro_id = reference_no.match(/^RO-?(\d+)$/i)&.captures&.first&.to_i
          
          receipt_orders = if ro_id.present?
            receipt_order_scope.where("reference_no ILIKE ? OR cats_warehouse_receipt_orders.id = ?", "%#{sanitized_ref}%", ro_id).limit(5)
          else
            receipt_order_scope.where("reference_no ILIKE ?", "%#{sanitized_ref}%").limit(5)
          end
        end
        
        receipt_orders.each do |order|
          commodity_names = order.receipt_order_lines.map { |l|
            commodity = Cats::Core::Commodity.find_by(id: l.commodity_id)
            commodity&.read_attribute(:name).presence || commodity&.batch_no || "Commodity ##{l.commodity_id}"
          }.join(", ")
          
          assignments = order.receipt_order_assignments.select { |a| current_ids.include?(a.store_id) }
          total_assigned_qty = assignments.any? ? assignments.sum(&:quantity).to_f : order.receipt_order_lines.sum(&:quantity).to_f

          first_line = order.receipt_order_lines.first
          unit_name = first_line ? Cats::Core::UnitOfMeasure.find_by(id: first_line.unit_id)&.abbreviation : nil
          created_by = order.created_by
          created_by_name = created_by ? [created_by.first_name, created_by.last_name].compact.join(" ").presence || created_by.email : nil

          # Build per-line details for stack configuration auto-fill
          lines_data = order.receipt_order_lines.map { |l|
            line_assignments = assignments.select { |a| a.receipt_order_line_id == l.id }
            assigned_qty = if line_assignments.any?
                             line_assignments.sum(&:quantity)
                           elsif assignments.any? && assignments.first.receipt_order_line_id.nil?
                             # Order-level assignment, use the assigned quantity
                             assignments.first.quantity
                           else
                             l.quantity
                           end

            commodity = Cats::Core::Commodity.find_by(id: l.commodity_id)
            unit = Cats::Core::UnitOfMeasure.find_by(id: l.unit_id)
            {
              commodity_id: l.commodity_id,
              commodity_name: commodity&.read_attribute(:name).presence || commodity&.batch_no || "Commodity ##{l.commodity_id}",
              batch_no: commodity&.batch_no.presence || l.line_reference_no,
              quantity: assigned_qty.to_f,
              unit_id: l.unit_id,
              unit_name: unit&.name,
              unit_abbreviation: unit&.abbreviation
            }
          }

          first_commodity = first_line ? Cats::Core::Commodity.find_by(id: first_line.commodity_id) : nil

          results << {
            type: "Receipt Order",
            reference_no: order.reference_no || "RO-#{order.id}",
            commodity: commodity_names,
            quantity: total_assigned_qty,
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
          # Search Dispatch Orders
          dispatch_orders = DispatchOrder
            .where("reference_no ILIKE ?", "%#{sanitized_ref}%")
            .joins(:dispatch_order_assignments)
            .where(dispatch_order_assignments: { store_id: current_ids })
            .includes(:warehouse, :hub, :created_by, :dispatch_order_lines)
            .limit(5)
          
          dispatch_orders.each do |order|
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
          
          # Search Waybills if they exist
          if defined?(Waybill)
            waybills = Waybill
              .where("reference_no ILIKE ?", "%#{sanitized_ref}%")
              .includes(:dispatch_order)
              .limit(5)
            
            waybills.each do |waybill|
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

        receipt_assignments = ReceiptOrderAssignment
          .where(assigned_to_id: current_user.id)
          .or(ReceiptOrderAssignment.where(store_id: current_ids))
          .includes(:receipt_order, :store, :warehouse, :hub, :assigned_to, :assigned_by)
          .order(created_at: :desc)

        dispatch_assignments = DispatchOrderAssignment
          .where(assigned_to_id: current_user.id)
          .or(DispatchOrderAssignment.where(store_id: current_ids))
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
          .where(assigned_to_id: current_user.id)
          .or(ReceiptOrderAssignment.where(store_id: current_store_ids))
          .find(params[:id])
      end

      def current_store_ids
        access = AccessContext.new(user: current_user)
        access.assigned_store_ids
      end

      # Sanitize input for LIKE queries to prevent SQL injection
      def sanitize_like_input(input)
        # Escape SQL LIKE wildcards and backslashes
        input.gsub(/[%_\\]/, '\\\\\\&')
      end
    end
  end
end
