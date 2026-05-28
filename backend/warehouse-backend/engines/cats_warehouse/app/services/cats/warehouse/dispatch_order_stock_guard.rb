# frozen_string_literal: true

module Cats
  module Warehouse
    # Ensures source allocation base quantities do not exceed aggregated stock balance per warehouse+commodity definition.
    class DispatchOrderStockGuard
      def self.call(order)
        new(order: order).call
      end

      def initialize(order:)
        @order = order
      end

      def call
        return unless @order.v2_dispatch?

        violations = []

        @order.dispatch_order_lines.includes(:commodity, :source_allocations).find_each do |line|
          commodity_ids = commodity_ids_for_line(line)
          next if commodity_ids.empty?

          requested_by_warehouse = Hash.new(0.0)
          line.source_allocations.each do |alloc|
            requested_by_warehouse[alloc.warehouse_id] += alloc.base_quantity.to_f
          end

          requested_by_warehouse.each do |warehouse_id, need_base|
            next if need_base <= 0

            have = DispatchStockAvailability.available_base_quantity_per_warehouse(
              commodity_ids: commodity_ids,
              warehouse_ids: [warehouse_id]
            )[warehouse_id] || 0.0

            tolerance = 0.001
            next if need_base <= have + tolerance

            violations << {
              warehouse_id: warehouse_id,
              commodity_id: line.commodity_id,
              commodity_name: CommodityDefinitionStockResolver.core_commodity_catalog_name(line.commodity),
              available_base_quantity: have.round(3),
              requested_base_quantity: need_base.round(3)
            }
          end
        end

        return if violations.empty?

        raise InsufficientStockError.new(
          "Insufficient stock for one or more source warehouses",
          details: { violations: violations }
        )
      end

      private

      def commodity_ids_for_line(line)
        definition = CommodityDefinitionStockResolver.definition_for_core_commodity(line.commodity)
        if definition
          CommodityDefinitionStockResolver.core_commodity_ids_for_definition(definition)
        else
          [line.commodity_id]
        end
      end
    end
  end
end
