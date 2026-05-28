# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchStackAllocationSerializer < ApplicationSerializer
      attributes :id, :dispatch_order_authorization_execution_id, :gin_id,
                 :stack_id, :stack_code, :store_id, :store_name,
                 :quantity, :base_quantity, :commodity_grade

      def stack_code
        object.stack&.code
      end

      def store_id
        object.stack&.store_id
      end

      def store_name
        object.stack&.store&.name
      end
    end
  end
end
