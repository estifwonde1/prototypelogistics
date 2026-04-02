module Cats
  module Warehouse
    class SpaceReservationService
      def initialize(order:, actor:, reservations:)
        @order = order
        @actor = actor
        @reservations = Array(reservations)
      end

      def call
        raise ArgumentError, "reservations are required" if @reservations.empty?

        ReceiptOrder.transaction do
          @reservations.each do |payload|
            line =
              if payload[:receipt_order_line_id].present?
                @order.receipt_order_lines.find(payload[:receipt_order_line_id])
              else
                # UI currently reserves space without selecting a specific receipt order line.
                # If there's exactly one line, assume it. Otherwise, require the frontend to send `receipt_order_line_id`.
                lines = @order.receipt_order_lines.to_a
                raise ArgumentError, "receipt_order_line_id is required when the receipt order has multiple lines" if lines.many?

                lines.first
              end

            store = payload[:store_id].present? ? Store.find(payload[:store_id]) : nil
            warehouse = payload[:warehouse_id].present? ? Warehouse.find(payload[:warehouse_id]) : @order.warehouse
            assignment = payload[:receipt_order_assignment_id].present? ? @order.receipt_order_assignments.find(payload[:receipt_order_assignment_id]) : nil

            ensure_space_available!(store || warehouse, payload[:reserved_volume], payload[:reserved_quantity])

            raise ArgumentError, "receipt_order_line_id is required" if line.blank?

            SpaceReservation.create!(
              receipt_order: @order,
              receipt_order_line: line,
              receipt_order_assignment: assignment,
              warehouse: warehouse,
              store: store,
              reserved_quantity: payload[:reserved_quantity],
              reserved_volume: payload[:reserved_volume],
              status: payload[:status].presence || "Reserved",
              reserved_by: @actor
            )
          end

          transition_order!("Reserved", "receipt_order.space_reserved", reservations_count: @reservations.size)
          @order
        end
      end

      private

      def ensure_space_available!(target, reserved_volume, reserved_quantity)
        return unless target.is_a?(Store)

        currently_reserved = target.space_reservations.where(status: "Reserved").sum(:reserved_volume).to_f
        requested = reserved_volume.to_f
        return if requested <= 0 || (currently_reserved + requested) <= target.available_space.to_f

        raise ArgumentError, "reserved volume exceeds available store capacity"
      end

      def transition_order!(new_status, event_type, payload)
        old_status = @order.status
        @order.update!(status: new_status)
        WorkflowEventRecorder.record!(entity: @order, event_type: event_type, actor: @actor, from_status: old_status, to_status: new_status, payload: payload)
      end
    end
  end
end
