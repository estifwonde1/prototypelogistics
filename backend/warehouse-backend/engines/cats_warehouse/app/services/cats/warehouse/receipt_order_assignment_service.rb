module Cats
  module Warehouse
    class ReceiptOrderAssignmentService
      ALLOWED_ASSIGNMENT_STATUSES = %w[pending assigned accepted in_progress completed rejected].freeze

      def initialize(order:, actor:, assignments:)
        @order = order
        @actor = actor
        @assignments = Array(assignments)
      end

      def call
        raise ArgumentError, "assignments are required" if @assignments.empty?

        ReceiptOrder.transaction do
          @assignments.each do |payload|
            line = find_line(payload[:receipt_order_line_id])

            ReceiptOrderAssignment.create!(
              receipt_order: @order,
              receipt_order_line: line,
              hub_id: payload[:hub_id] || @order.warehouse&.hub_id || @order.hub_id,
              warehouse_id: payload[:warehouse_id] || @order.warehouse_id,
              store_id: payload[:store_id],
              assigned_by: @actor,
              assigned_to_id: assigned_to_id_for(payload),
              quantity: payload[:quantity],
              status: normalize_assignment_status(payload[:status])
            )
          end

          # Recalculate and update order status based on assignment completeness
          update_order_status!

          enqueue_notification(
            "receipt_order.assigned",
            receipt_order_id: @order.id,
            assigned_to_ids: @assignments.map { |p| p[:assigned_to_id] }.compact
          )

          @order
        end
      end

      private

      def update_order_status!
        # CRITICAL: For multi-hub/multi-warehouse orders, we should NOT change the order status
        # based on partial assignments. Each hub's assignment is independent.
        # Only change order status if this is a single-destination order.
        
        # Check if this is a multi-hub order (multiple hub-level assignments)
        all_assignments = ReceiptOrderAssignment.where(receipt_order: @order)
        unique_hubs = all_assignments.where.not(hub_id: nil).pluck(:hub_id).uniq
        
        # If multiple hubs are involved, don't change order status
        # Each hub manager works independently
        return if unique_hubs.size > 1
        
        # For single-hub or single-warehouse orders, check if fully assigned
        new_status = if all_lines_assigned_to_warehouses?
                       ContractConstants::DOCUMENT_STATUSES[:assigned]
                     else
                       # If not all lines are assigned, keep it as confirmed (or current status if not assigned)
                       current = @order.status.to_s.downcase
                       current == 'assigned' ? ContractConstants::DOCUMENT_STATUSES[:confirmed] : @order.status
                     end

        # Only transition if status actually changes
        if @order.status.to_s.downcase != new_status.to_s.downcase
          transition_order!(
            new_status,
            new_status == ContractConstants::DOCUMENT_STATUSES[:assigned] ? "receipt_order.assigned" : "receipt_order.partially_assigned",
            assignments_count: @assignments.size
          )
        end
      end

      def all_lines_assigned_to_warehouses?
        # Reload assignments to get the latest state
        all_assignments = ReceiptOrderAssignment.where(receipt_order: @order)
        
        # Get all lines
        lines = @order.receipt_order_lines
        return false if lines.empty?
        
        # For each line, check if it has a warehouse-level assignment
        lines.all? do |line|
          # Find assignments for this specific line
          line_assignments = all_assignments.select do |assignment|
            assignment.receipt_order_line_id == line.id
          end
          
          # Check if any of these assignments have a warehouse_id
          line_assignments.any? { |a| a.warehouse_id.present? }
        end
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end

      def normalize_assignment_status(raw)
        return ContractConstants::DOCUMENT_STATUSES[:assigned] if raw.blank?

        key = raw.to_s.strip.downcase.tr(" ", "_")
        return key if ALLOWED_ASSIGNMENT_STATUSES.include?(key)

        ContractConstants::DOCUMENT_STATUSES[:assigned]
      end

      def find_line(id)
        return nil if id.blank?

        @order.receipt_order_lines.find(id)
      end

      def assigned_to_id_for(payload)
        return payload[:assigned_to_id] if payload[:assigned_to_id].present?

        if payload[:store_id].present?
          store = Store.find_by(id: payload[:store_id])
          return facility_user_id(role_name: "Storekeeper", store_id: store.id) ||
                 facility_user_id(role_name: "Storekeeper", warehouse_id: store.warehouse_id) if store
        end

        warehouse_id = payload[:warehouse_id].presence || @order.warehouse_id
        if warehouse_id.present?
          return facility_user_id(role_name: "Warehouse Manager", warehouse_id: warehouse_id)
        end

        hub_id = payload[:hub_id].presence || @order.warehouse&.hub_id || @order.hub_id
        return facility_user_id(role_name: "Hub Manager", hub_id: hub_id) if hub_id.present?

        nil
      end

      def facility_user_id(role_name:, hub_id: nil, warehouse_id: nil, store_id: nil)
        UserAssignment.includes(:user)
                      .where(role_name: role_name, hub_id: hub_id, warehouse_id: warehouse_id, store_id: store_id)
                      .order(:id)
                      .map(&:user)
                      .find { |user| user&.active? }
                      &.id
      end

      def transition_order!(new_status, event_type, payload)
        old_status = @order.status
        @order.update!(status: new_status)
        WorkflowEventRecorder.record!(entity: @order, event_type: event_type, actor: @actor, from_status: old_status, to_status: new_status, payload: payload)
      end
    end
  end
end
