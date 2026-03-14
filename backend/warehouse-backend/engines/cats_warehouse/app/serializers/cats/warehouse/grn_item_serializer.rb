module Cats
  module Warehouse
    class GrnItemSerializer < ApplicationSerializer
      attributes :id, :grn_id, :commodity_id, :quantity, :unit_id, :quality_status, :store_id, :stack_id, :created_at, :updated_at
    end
  end
end
