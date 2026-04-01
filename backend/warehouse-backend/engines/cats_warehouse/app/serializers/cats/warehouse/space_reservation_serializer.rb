module Cats
  module Warehouse
    class SpaceReservationSerializer < ApplicationSerializer
      attributes :id, :receipt_order_id, :receipt_order_line_id, :receipt_order_assignment_id, :warehouse_id,
                 :store_id, :reserved_quantity, :reserved_volume, :status, :reserved_by_id, :created_at, :updated_at
    end
  end
end
