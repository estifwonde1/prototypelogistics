# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchExchangeReceiveService
      def initialize(dispatch_order:, actor:, warehouse:, commodity_id:, quantity:, unit_id:, packaging_unit_id: nil, packaging_size: nil)
        @order = dispatch_order
        @actor = actor
        @warehouse = warehouse
        @commodity_id = commodity_id
        @quantity = quantity
        @unit_id = unit_id
        @packaging_unit_id = packaging_unit_id
        @packaging_size = packaging_size
      end

      def call
        raise ArgumentError, "Order is not an exchange dispatch" unless @order.exchange_order?

        commodity = Cats::Core::Commodity.find(@commodity_id)

        PackagingTransactionPoster.new(
          actor: @actor,
          transaction_type: PackagingTransaction::RECEIVE,
          warehouse: @warehouse,
          commodity: commodity,
          quantity: @quantity,
          unit_id: @unit_id,
          reference_order: @order,
          packaging_unit_id: @packaging_unit_id,
          packaging_size: @packaging_size,
          apply_inventory: ENV["PACKAGING_AFFECTS_INVENTORY"] == "true"
        ).call
      end
    end
  end
end
