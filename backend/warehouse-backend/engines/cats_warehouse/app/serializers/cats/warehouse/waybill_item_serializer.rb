module Cats
  module Warehouse
    class WaybillItemSerializer < ApplicationSerializer
      attributes :id, :waybill_id, :commodity_id, :quantity, :unit_id, :created_at, :updated_at
    end
  end
end
