# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderStatusAggregator
      def self.call(order)
        new(order: order).call
      end

      def initialize(order:)
        @order = order
      end

      def call
        return unless @order.v2_dispatch?

        auths = @order.dispatch_order_authorizations.where.not(status: DispatchOrderAuthorization::CANCELLED)
        return if auths.empty?

        if auths.all? { |a| a.status == DispatchOrderAuthorization::COMPLETED }
          update_order_status!(ContractConstants::DOCUMENT_STATUSES[:completed])
        elsif auths.any? { |a| a.status == DispatchOrderAuthorization::IN_PROGRESS }
          update_order_status!(ContractConstants::DOCUMENT_STATUSES[:in_progress])
        elsif auths.any? { |a| a.remaining_quantity.to_f.positive? && a.dispatched_quantity_positive?(a) }
          update_order_status!(ContractConstants::DOCUMENT_STATUSES[:partially_dispatched])
        elsif fully_authorized?(auths)
          update_order_status!(ContractConstants::DOCUMENT_STATUSES[:fully_authorized])
        elsif auths.where(status: DispatchOrderAuthorization::CONFIRMED).exists?
          update_order_status!(ContractConstants::DOCUMENT_STATUSES[:partially_authorized])
        end
      end

      private

      def fully_authorized?(auths)
        auths.where(status: [DispatchOrderAuthorization::CONFIRMED, DispatchOrderAuthorization::IN_PROGRESS, DispatchOrderAuthorization::COMPLETED]).exists? &&
          remaining_unauthorized_base_quantity.zero?
      end

      def remaining_unauthorized_base_quantity
        allocated = DispatchLineSourceAllocation
          .joins(:dispatch_order_line)
          .where(cats_warehouse_dispatch_order_lines: { dispatch_order_id: @order.id })
          .sum(:base_quantity)
          .to_f

        authorized = @order.dispatch_order_authorizations
          .where.not(status: DispatchOrderAuthorization::CANCELLED)
          .sum(:authorized_base_quantity)
          .to_f

        [allocated - authorized, 0].max
      end

      def update_order_status!(new_status)
        return if @order.status == new_status

        old = @order.status
        @order.update!(status: new_status)
        WorkflowEventRecorder.record!(
          entity: @order,
          event_type: "dispatch_order.status_aggregated",
          actor: nil,
          from_status: old,
          to_status: new_status
        )
      end
    end
  end
end
