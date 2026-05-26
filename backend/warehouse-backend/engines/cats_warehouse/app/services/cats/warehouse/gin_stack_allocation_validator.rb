# frozen_string_literal: true

module Cats
  module Warehouse
    class GinStackAllocationValidator
      def initialize(gin:, allocations:)
        @gin = gin
        @allocations = allocations
      end

      def call
        raise ArgumentError, "stack allocations are required" if @allocations.blank?

        @allocations.group_by { |a| a[:gin_item_id] || a[:commodity_id] }.each do |_key, rows|
          validate_group!(rows)
        end
      end

      private

      def validate_group!(rows)
        commodity_id = rows.first[:commodity_id]
        gin_item = @gin.gin_items.find_by(commodity_id: commodity_id) if commodity_id.present?
        expected = gin_item&.base_quantity || gin_item&.quantity
        expected ||= rows.sum { |r| r[:quantity].to_f }

        allocated = rows.sum { |r| r[:quantity].to_f }
        return if (allocated - expected.to_f).abs <= 0.001

        raise ArgumentError, "Stack allocations (#{allocated}) do not match GIN item quantity (#{expected})"
      end
    end
  end
end
