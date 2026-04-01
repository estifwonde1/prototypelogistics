module Cats
  module Warehouse
    class ReceiptOrderAssignmentService
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
              hub_id: payload[:hub_id] || @order.hub_id,
              warehouse_id: payload[:warehouse_id] || @order.warehouse_id,
              store_id: payload[:store_id],
              assigned_by: @actor,
              assigned_to_id: payload[:assigned_to_id],
              quantity: payload[:quantity],
              status: payload[:status].presence || "Assigned"
            )
          end

          transition_order!("Assigned", "receipt_order.assigned", assignments_count: @assignments.size)
          @order
        end
      end

      private

      def find_line(id)
        return nil if id.blank?

        @order.receipt_order_lines.find(id)
      end

      def transition_order!(new_status, event_type, payload)
        old_status = @order.status
        @order.update!(status: new_status)
        WorkflowEventRecorder.record!(entity: @order, event_type: event_type, actor: @actor, from_status: old_status, to_status: new_status, payload: payload)
      end
    end
  end
end
