# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationQuantityLedger
      def self.validate!(dispatch_order:, warehouse:, commodity_id:, additional_base_quantity:)
        new(
          dispatch_order: dispatch_order,
          warehouse: warehouse,
          commodity_id: commodity_id,
          additional_base_quantity: additional_base_quantity
        ).validate!
      end

      def initialize(dispatch_order:, warehouse:, commodity_id:, additional_base_quantity:)
        @dispatch_order = dispatch_order
        @warehouse = warehouse
        @commodity_id = commodity_id
        @additional = additional_base_quantity.to_f
      end

      def validate!
        allocated = allocated_base_for_warehouse_commodity
        already = authorized_base_for_warehouse_commodity

        if already + @additional > allocated + 0.001
          raise ArgumentError,
                "Authorized quantity exceeds allocated source quantity for warehouse #{@warehouse.id} and commodity #{@commodity_id}"
        end
      end

      private

      def allocated_base_for_warehouse_commodity
        DispatchLineSourceAllocation
          .joins(:dispatch_order_line)
          .where(
            cats_warehouse_dispatch_order_lines: {
              dispatch_order_id: @dispatch_order.id,
              commodity_id: @commodity_id
            },
            warehouse_id: @warehouse.id
          )
          .sum("COALESCE(cats_warehouse_dispatch_line_source_allocations.base_quantity, cats_warehouse_dispatch_line_source_allocations.quantity)")
          .to_f
      end

      def authorized_base_for_warehouse_commodity
        scope = DispatchOrderAuthorization
          .where(dispatch_order_id: @dispatch_order.id, warehouse_id: @warehouse.id)
          .where.not(status: [DispatchOrderAuthorization::DRAFT, DispatchOrderAuthorization::CANCELLED])

        # Filter by commodity_id when available (new auths); fall back to store splits for legacy auths
        commodity_scope = scope.where(commodity_id: @commodity_id)
        commodity_sum = commodity_scope.sum(:authorized_base_quantity).to_f

        # Legacy auths without commodity_id — sum only the portion from store splits for this commodity
        legacy_ids = scope.where(commodity_id: nil).pluck(:id)
        if legacy_ids.any?
          legacy_sum = DispatchOrderAuthorizationStore
            .where(dispatch_order_authorization_id: legacy_ids, commodity_id: @commodity_id)
            .sum(:base_quantity)
            .to_f
          commodity_sum + legacy_sum
        else
          commodity_sum
        end
      end
    end
  end
end
