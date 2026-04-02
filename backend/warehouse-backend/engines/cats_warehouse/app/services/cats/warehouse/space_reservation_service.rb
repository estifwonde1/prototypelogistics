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

            ensure_line_remaining_capacity!(line, payload[:reserved_quantity])

            create_or_merge_reservation!(
              line: line,
              warehouse: warehouse,
              store: store,
              assignment: assignment,
              payload: payload
            )

            ensure_reservation_stack_for_line!(line: line, store: store)
          end

          transition_order!("Reserved", "receipt_order.space_reserved", reservations_count: @reservations.size)
          @order
        end
      end

      private

      def create_or_merge_reservation!(line:, warehouse:, store:, assignment:, payload:)
        existing = SpaceReservation.find_by(
          receipt_order_line_id: line.id,
          warehouse_id: warehouse.id,
          store_id: store&.id
        )

        delta_qty = payload[:reserved_quantity].to_f

        if existing
          attrs = {
            reserved_quantity: existing.reserved_quantity.to_f + delta_qty,
            reserved_by: @actor
          }
          attrs[:status] = payload[:status] if payload[:status].present?
          attrs[:receipt_order_assignment_id] = assignment.id if assignment
          if payload[:reserved_volume].present?
            attrs[:reserved_volume] = existing.reserved_volume.to_f + payload[:reserved_volume].to_f
          end
          existing.update!(attrs)
        else
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
      end

      # GRN requires a concrete stack row; space reservation alone does not create one.
      # One deterministic stack per (receipt order, line, store) for receiving.
      def ensure_reservation_stack_for_line!(line:, store:)
        return if store.blank?
        return if line.blank? || line.commodity_id.blank? || line.unit_id.blank?

        code = "RES-RO#{@order.id}-L#{line.id}-S#{store.id}"
        stack = Stack.find_or_initialize_by(store_id: store.id, code: code)
        return unless stack.new_record?

        dims = default_stack_dimensions_for_store(store)
        stack.assign_attributes(
          commodity_id: line.commodity_id,
          unit_id: line.unit_id,
          stack_status: "Reserved",
          commodity_status: "Good",
          quantity: 0,
          start_x: 0,
          start_y: 0,
          **dims
        )
        stack.save!
      end

      def default_stack_dimensions_for_store(store)
        scale = 0.2
        l = (store.length.to_f * scale).clamp(0.01, store.length.to_f * 0.99)
        w = (store.width.to_f * scale).clamp(0.01, store.width.to_f * 0.99)
        h = (store.height.to_f * scale).clamp(0.01, store.height.to_f * 0.99)
        { length: l, width: w, height: h }
      end

      def ensure_line_remaining_capacity!(line, requested_quantity)
        requested = requested_quantity.to_f
        return if requested <= 0

        already = line.space_reservations.where.not(status: %w[cancelled released]).sum(:reserved_quantity).to_f
        max_qty = line.quantity.to_f
        remaining = max_qty - already
        return if requested <= remaining + 1e-9

        raise ArgumentError,
              "cannot reserve #{requested} units; only #{remaining.round(4)} remaining for this line (ordered #{max_qty})"
      end

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
