module Cats
  module Warehouse
    class GinItemSerializer < ApplicationSerializer
      attributes :id, :gin_id, :commodity_id, :quantity, :unit_id, :store_id, :stack_id, :created_at, :updated_at
    end
  end
end
