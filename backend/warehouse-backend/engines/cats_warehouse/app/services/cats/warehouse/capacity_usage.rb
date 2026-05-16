# frozen_string_literal: true

module Cats
  module Warehouse
    # Aggregates MT in use vs remaining from live stock balances.
    class CapacityUsage
      UsageResult = Struct.new(
        :capacity_mt,
        :used_mt,
        :remaining_mt,
        :utilization_pct,
        keyword_init: true
      )

      def self.for_warehouse(warehouse)
        new(warehouse: warehouse).warehouse_usage
      end

      def self.for_store(store)
        new(store: store).store_usage
      end

      def self.for_stack(stack)
        new(stack: stack).stack_usage
      end

      def initialize(warehouse: nil, store: nil, stack: nil)
        @warehouse = warehouse
        @store = store
        @stack = stack
      end

      def warehouse_usage
        wh = @warehouse
        cap = wh&.warehouse_capacity
        capacity_mt = cap&.usable_storage_capacity_mt.to_f
        used_mt = sum_base_quantity(warehouse_id: wh.id)
        build_result(capacity_mt, used_mt)
      end

      def store_usage
        store = @store
        capacity_mt = store.allocated_capacity_mt.to_f
        used_mt = sum_base_quantity(store_id: store.id)
        build_result(capacity_mt, used_mt)
      end

      def stack_usage
        stack = @stack
        capacity_mt = stack.max_capacity_mt.to_f
        used_mt = stack.base_quantity.to_f
        build_result(capacity_mt, used_mt)
      end

      private

      def sum_base_quantity(scope)
        StockBalance.where(scope).sum(:base_quantity).to_f
      end

      def build_result(capacity_mt, used_mt)
        remaining = [capacity_mt - used_mt, 0].max
        utilization = capacity_mt.positive? ? ((used_mt / capacity_mt) * 100.0).round(2) : 0.0

        UsageResult.new(
          capacity_mt: capacity_mt.round(4),
          used_mt: used_mt.round(4),
          remaining_mt: remaining.round(4),
          utilization_pct: utilization
        )
      end
    end
  end
end
