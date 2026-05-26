# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderSelfApprovalService
      def initialize(order:, actor:)
        @order = order
        @actor = actor
      end

      def call
        raise ArgumentError, "Only the creator can self-approve this dispatch order" unless @order.created_by_id == @actor.id
        raise ArgumentError, "Only draft orders can be confirmed" unless @order.status_draft?

        DispatchOrderConfirmer.new(order: @order, confirmed_by: @actor, self_approve: true).call
      end
    end
  end
end
