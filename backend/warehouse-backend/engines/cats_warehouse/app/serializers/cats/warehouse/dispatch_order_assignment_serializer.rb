module Cats
  module Warehouse
    class DispatchOrderAssignmentSerializer < ApplicationSerializer
      attributes :id, :dispatch_order_id, :dispatch_order_line_id, :hub_id, :warehouse_id, :store_id,
                 :assigned_by_id, :assigned_to_id, :quantity, :status, :created_at, :updated_at
    end
  end
end
