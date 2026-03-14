module Cats
  module Warehouse
    class StackSerializer < ApplicationSerializer
      attributes :id, :code, :length, :width, :height, :start_x, :start_y, :commodity_id, :store_id,
                 :commodity_status, :stack_status, :quantity, :unit_id, :created_at, :updated_at
    end
  end
end
