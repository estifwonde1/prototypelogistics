module Cats
  module Warehouse
    class StockBalanceSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :store_id, :stack_id, :commodity_id, :quantity, :unit_id, :created_at, :updated_at
    end
  end
end
