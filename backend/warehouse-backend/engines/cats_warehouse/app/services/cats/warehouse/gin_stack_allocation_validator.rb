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

        stack_ids = @allocations.map { |a| a[:stack_id].to_i }
        if stack_ids.uniq.length != stack_ids.length
          raise ArgumentError, "Each stack can only appear once in allocations"
        end

        if @gin.gin_items.count == 1
          validate_against_gin_item!(@gin.gin_items.first, @allocations)
        else
          @allocations.group_by { |a| a[:gin_item_id] || a[:commodity_id] }.each do |_key, rows|
            gin_item = resolve_gin_item_for_group(rows)
            validate_against_gin_item!(gin_item, rows)
          end
        end
      end

      private

      def validate_against_gin_item!(gin_item, rows)
        expected = gin_item&.base_quantity || gin_item&.quantity
        expected ||= rows.sum { |r| r[:quantity].to_f }

        allocated = rows.sum { |r| r[:quantity].to_f }
        unless (allocated - expected.to_f).abs <= 0.001
          raise ArgumentError, "Stack allocations (#{allocated}) do not match GIN item quantity (#{expected})"
        end

        allowed_commodity_ids = allowed_commodity_ids_for(gin_item)
        rows.each { |row| validate_row!(row, allowed_commodity_ids) }
      end

      def resolve_gin_item_for_group(rows)
        commodity_id = rows.first[:commodity_id]
        @gin.gin_items.find_by(commodity_id: commodity_id) || @gin.gin_items.first
      end

      def allowed_commodity_ids_for(gin_item)
        anchor_id = gin_item&.commodity_id
        return [] unless anchor_id.present?

        CommodityDefinitionStockResolver.core_commodity_ids_for_core_commodity(anchor_id)
      end

      def validate_row!(row, allowed_commodity_ids)
        stack = Stack.includes(:store).find(row[:stack_id])
        qty = row[:quantity].to_f
        raise ArgumentError, "Quantity must be positive" unless qty.positive?

        if stack.store&.warehouse_id != @gin.warehouse_id
          raise ArgumentError, "Stack #{stack.code || stack.id} does not belong to this GIN warehouse"
        end

        row_commodity_id = resolve_row_commodity_id(row, stack)
        if allowed_commodity_ids.present? && !allowed_commodity_ids.include?(row_commodity_id)
          raise ArgumentError, "Stack #{stack.code || stack.id} holds a different commodity"
        end

        available = stack_available_quantity(stack, row_commodity_id)
        if qty > available + 0.001
          raise ArgumentError,
                "Stack #{stack.code || stack.id} only has #{available} available (requested #{qty})"
        end
      end

      def resolve_row_commodity_id(row, stack)
        row_id = row[:commodity_id].to_i
        return row_id if row_id.positive?

        balance = StockBalance
          .where(warehouse_id: @gin.warehouse_id, stack_id: stack.id)
          .where("COALESCE(available_quantity, quantity) > 0")
          .order(updated_at: :desc)
          .first
        balance&.commodity_id || stack.commodity_id
      end

      def stack_available_quantity(stack, commodity_id)
        balance = StockBalance.find_by(
          warehouse_id: @gin.warehouse_id,
          stack_id: stack.id,
          commodity_id: commodity_id.presence || stack.commodity_id
        )
        avail = balance&.available_quantity || balance&.quantity
        return avail.to_f if avail.present?

        stack.quantity.to_f
      end
    end
  end
end
