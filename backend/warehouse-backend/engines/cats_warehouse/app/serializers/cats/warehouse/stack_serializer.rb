module Cats
  module Warehouse
    class StackSerializer < ApplicationSerializer
      attributes :id, :code, :length, :width, :height, :start_x, :start_y, :commodity_id, :store_id,
                 :commodity_name, :commodity_code, :store_name, :store_code, :warehouse_id,
                 :commodity_status, :stack_status, :quantity, :unit_id, :unit_name, :unit_abbreviation,
                 :base_unit_id, :base_unit_name, :base_quantity, :reference,
                 :max_capacity_mt, :used_capacity_mt, :remaining_capacity_mt, :utilization_pct,
                 :created_at, :updated_at

      def max_capacity_mt
        object.max_capacity_mt
      end

      def used_capacity_mt
        stack_usage.used_mt
      end

      def remaining_capacity_mt
        stack_usage.remaining_mt
      end

      def utilization_pct
        stack_usage.utilization_pct
      end

      def commodity_id
        object.commodity_id || positive_stack_balance&.commodity_id
      end

      def commodity_name
        commodity = object.commodity || positive_stack_balance&.commodity
        commodity&.[](:name) || commodity&.batch_no
      end

      def commodity_code
        commodity = object.commodity || positive_stack_balance&.commodity
        commodity&.[](:code)
      end

      def stack_status
        return "active" if object.quantity.to_f.positive?

        object[:stack_status].presence || "empty"
      end

      def store_name
        object.store&.name
      end

      def store_code
        object.store&.code
      end

      def warehouse_id
        object.store&.warehouse_id
      end

      def unit_name
        unit = object.unit || positive_stack_balance&.unit
        unit&.name
      end

      def unit_abbreviation
        unit = object.unit || positive_stack_balance&.unit
        unit&.abbreviation
      end

      def base_unit_name
        object.base_unit&.name
      end

      private

      def stack_usage
        @stack_usage ||= CapacityUsage.for_stack(object)
      end

      def positive_stack_balance
        return @positive_stack_balance if defined?(@positive_stack_balance)

        @positive_stack_balance =
          object.stock_balances
                .includes(:commodity, :unit)
                .where("quantity > 0")
                .order(updated_at: :desc)
                .first
      end
    end
  end
end
