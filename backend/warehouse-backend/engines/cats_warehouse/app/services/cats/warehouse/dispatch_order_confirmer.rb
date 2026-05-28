# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderConfirmer
      def initialize(order:, confirmed_by: nil, self_approve: false)
        @order = order
        @confirmed_by = confirmed_by
        @self_approve = self_approve
      end

      def call
        @order.ensure_confirmable!

        DispatchOrder.transaction do
          @order.lock!

          if @order.v2_dispatch?
            DispatchOrderStockGuard.call(@order)
            DispatchAllocationReconciler.call(@order, strict: true)
            DispatchOrderJurisdictionGuard.call(@order, @confirmed_by) if @confirmed_by.present?
          end

          @order.reference_no = generated_reference_no if @order.reference_no.blank?
          old_status = @order.status
          now = Time.current

          @order.update!(
            status: ContractConstants::DOCUMENT_STATUSES[:confirmed],
            confirmed_by: @confirmed_by || @order.confirmed_by,
            confirmed_at: now,
            approved_by: @confirmed_by || @order.approved_by,
            approved_at: now
          )

          WorkflowEventRecorder.record!(
            entity: @order,
            event_type: @self_approve ? "dispatch_order.self_approved" : "dispatch_order.confirmed",
            actor: @confirmed_by,
            from_status: old_status,
            to_status: @order.status
          )

          notify_managers!

          @order
        end
      end

      private

      def generated_reference_no
        "DO-#{SecureRandom.hex(4).upcase}"
      end

      def notify_managers!
        warehouse_ids = if @order.v2_dispatch?
          DispatchLineSourceAllocation
            .joins(:dispatch_order_line)
            .where(cats_warehouse_dispatch_order_lines: { dispatch_order_id: @order.id })
            .distinct
            .pluck(:warehouse_id)
        else
          [@order.warehouse_id].compact
        end

        NotificationFanout.deliver(
          "dispatch_order.confirmed",
          dispatch_order_id: @order.id,
          warehouse_ids: warehouse_ids,
          dispatch_reference: @order.dispatch_reference
        )
      end
    end
  end
end
