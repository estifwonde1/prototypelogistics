module Cats
  module Warehouse
    class ReceiptOrderAssignmentSerializer < ApplicationSerializer
      attributes :id, :receipt_order_id, :receipt_order_line_id, :hub_id, :warehouse_id, :store_id,
                 :assigned_by_id, :assigned_to_id, :quantity, :status, :created_at, :updated_at
    end
  end
end
