module Cats
  module Warehouse
    class StockBalanceSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :store_id, :stack_id, :commodity_id, :quantity, :unit_id, :warehouse_name

      def warehouse_name
        object.warehouse&.name
      end
    end
  end
end
