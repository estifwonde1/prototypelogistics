# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationExecutionSerializer < ApplicationSerializer
      attributes :id, :quantity, :base_quantity, :shortage_quantity, :shortage_reason,
                 :commodity_grade, :status, :storekeeper_id, :commodity_id
    end
  end
end
