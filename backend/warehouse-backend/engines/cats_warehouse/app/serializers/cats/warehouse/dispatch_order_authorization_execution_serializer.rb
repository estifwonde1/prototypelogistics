# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationExecutionSerializer < ApplicationSerializer
      attributes :id, :quantity, :base_quantity, :authorized_quantity, :shortage_quantity, :shortage_reason,
                 :commodity_grade, :inventory_lot_id, :status, :storekeeper_id, :commodity_id,
                 :dispatch_order_authorization_id, :dispatch_order_authorization_store_id
    end
  end
end
