# frozen_string_literal: true

module Cats
  module Warehouse
    class PackagingTransactionSerializer < ApplicationSerializer
      attributes :id, :transaction_type, :warehouse_id, :commodity_id, :quantity, :base_quantity,
                 :unit_id, :packaging_unit_id, :packaging_size, :package_count,
                 :occurred_at, :reference_order_type, :reference_order_id,
                 :dispatch_order_authorization_execution_id, :created_by_id, :status
    end
  end
end
