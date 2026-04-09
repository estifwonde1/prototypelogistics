module Cats
  module Warehouse
    class StockReservationSerializer < ApplicationSerializer
      attributes :id, :dispatch_order_id, :dispatch_order_line_id, :warehouse_id, :store_id, :stack_id,
                 :commodity_id, :unit_id, :inventory_lot_id, :reserved_quantity, :issued_quantity,
                 :status, :reserved_by_id, :created_at, :updated_at
    end
  end
end
