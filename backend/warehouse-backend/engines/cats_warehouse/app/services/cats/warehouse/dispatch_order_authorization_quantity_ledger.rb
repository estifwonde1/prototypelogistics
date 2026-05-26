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
          .sum(:base_quantity)
          .to_f
      end

      def authorized_base_for_warehouse_commodity
        DispatchOrderAuthorization
          .where(dispatch_order_id: @dispatch_order.id, warehouse_id: @warehouse.id)
          .where.not(status: DispatchOrderAuthorization::CANCELLED)
          .sum(:authorized_base_quantity)
          .to_f
      end
    end
  end
end
