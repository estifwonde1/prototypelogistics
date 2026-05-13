module Cats
  module Warehouse
    # Called after an RA transitions to closed (e.g. GRN confirmed) or cancelled.
    # Completes the Receipt Order only when every non-cancelled RA is closed **and**
    # closed RAs' authorized quantities cover every receipt order line (same UOM as the line).
    class ReceiptOrderCompletionChecker
      include ContractConstants

      QTY_EPS = 1e-6

      def initialize(receipt_order:, actor:)
        @order = receipt_order
        @actor = actor
      end

      def call
        @order.reload
        active_ras = @order.receipt_authorizations.not_cancelled.to_a
        return if active_ras.empty?

        all_closed = active_ras.all?(&:closed?)
        covered    = lines_fully_covered_by_closed_ras?(active_ras)

        if all_closed && covered
          promote_to_completed!(active_ras) unless @order.status_completed?
        elsif all_closed && !covered && @order.status_completed?
          revert_completed_to_in_progress!
        end
        # all_closed && !covered && !completed → leave status unchanged (e.g. in_progress)
        # !all_closed → leave unchanged (RAs still open)
      end

      private

      def lines_fully_covered_by_closed_ras?(active_ras)
        lines = @order.receipt_order_lines.to_a
        return false if lines.empty?

        closed = active_ras.select(&:closed?)
        return false if closed.empty?

        sums = Hash.new(0.0)
        ambiguous_nil_line = false

        closed.each do |ra|
          lid = ra.receipt_order_line_id
          if lid.blank?
            if lines.many?
              ambiguous_nil_line = true
              next
            end

            lid = lines.first.id
          end
          sums[lid.to_i] += ra.authorized_quantity.to_f
        end

        return false if ambiguous_nil_line

        lines.all? do |line|
          got = sums[line.id.to_i]
          got + QTY_EPS >= line.quantity.to_f
        end
      end

      def promote_to_completed!(active_ras)
        old_status = @order.status
        @order.update!(status: DOCUMENT_STATUSES[:completed])

        WorkflowEventRecorder.record!(
          entity:      @order,
          event_type:  "receipt_order.completed",
          actor:       @actor,
          from_status: old_status,
          to_status:   @order.status,
          payload:     {
            closed_ra_count: active_ras.count,
            completed_by:    @actor.id
          }
        )

        enqueue_notification("receipt_order.completed", receipt_order_id: @order.id)
      end

      def revert_completed_to_in_progress!
        old_status = @order.status
        @order.update!(status: DOCUMENT_STATUSES[:in_progress])

        WorkflowEventRecorder.record!(
          entity:      @order,
          event_type:  "receipt_order.completion_reverted",
          actor:       @actor,
          from_status: old_status,
          to_status:   @order.status,
          payload:     {
            reason: "closed_ras_do_not_cover_all_receipt_order_lines"
          }
        )
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
