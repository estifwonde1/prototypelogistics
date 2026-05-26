# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchAllocationReconciler
      def self.call(order, strict: true)
        new(order: order, strict: strict).call
      end

      def initialize(order:, strict: true)
        @order = order
        @strict = strict
      end

      def call
        @order.dispatch_order_lines.lock.find_each do |line|
          reconcile_line!(line)
        end
      end

      private

      def reconcile_line!(line)
        line_base = line.base_quantity.to_f
        source_sum = line.source_allocations.sum(:base_quantity).to_f
        dest_sum = line.destination_allocations.sum(:base_quantity).to_f

        return unless @strict

        tolerance = 0.001
        unless (source_sum - line_base).abs <= tolerance
          raise ArgumentError,
                "Source allocations (#{source_sum}) must equal line base quantity (#{line_base}) for line #{line.id}"
        end

        unless (dest_sum - line_base).abs <= tolerance
          raise ArgumentError,
                "Destination allocations (#{dest_sum}) must equal line base quantity (#{line_base}) for line #{line.id}"
        end

        unless (source_sum - dest_sum).abs <= tolerance
          raise ArgumentError, "Source and destination totals must match for line #{line.id}"
        end
      end
    end
  end
end
