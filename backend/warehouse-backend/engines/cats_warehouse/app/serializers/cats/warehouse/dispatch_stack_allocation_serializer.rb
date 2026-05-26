# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchStackAllocationSerializer < ApplicationSerializer
      attributes :id, :dispatch_order_authorization_execution_id, :gin_id,
                 :stack_id, :quantity, :base_quantity, :commodity_grade
    end
  end
end
