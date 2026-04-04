module Cats
  module Warehouse
    class DispatchOrderAssignmentService
      ALLOWED_ASSIGNMENT_STATUSES = %w[pending assigned accepted in_progress completed rejected].freeze

      def initialize(order:, actor:, assignments:)
        @order = order
        @actor = actor
        @assignments = Array(assignments)
      end

      def call
        raise ArgumentError, "assignments are required" if @assignments.empty?

        DispatchOrder.transaction do
          @assignments.each do |payload|
            line = find_line(payload[:dispatch_order_line_id])

            DispatchOrderAssignment.create!(
              dispatch_order: @order,
              dispatch_order_line: line,
              hub_id: payload[:hub_id] || @order.hub_id,
              warehouse_id: payload[:warehouse_id] || @order.warehouse_id,
              store_id: payload[:store_id],
              assigned_by: @actor,
              assigned_to_id: payload[:assigned_to_id],
              quantity: payload[:quantity],
              status: normalize_assignment_status(payload[:status])
            )
          end

          transition_order!(
            ContractConstants::DOCUMENT_STATUSES[:assigned],
            "dispatch_order.assigned",
            assignments_count: @assignments.size
          )
          @order
        end
      end

      private

      def normalize_assignment_status(raw)
        return ContractConstants::DOCUMENT_STATUSES[:assigned] if raw.blank?

        key = raw.to_s.strip.downcase.tr(" ", "_")
        return key if ALLOWED_ASSIGNMENT_STATUSES.include?(key)

        ContractConstants::DOCUMENT_STATUSES[:assigned]
      end

      def find_line(id)
        return nil if id.blank?

        @order.dispatch_order_lines.find(id)
      end

      def transition_order!(new_status, event_type, payload)
        old_status = @order.status
        @order.update!(status: new_status)
        WorkflowEventRecorder.record!(entity: @order, event_type: event_type, actor: @actor, from_status: old_status, to_status: new_status, payload: payload)
      end
    end
  end
end
