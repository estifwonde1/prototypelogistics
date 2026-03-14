module Cats
  module Warehouse
    class InspectionItemSerializer < ApplicationSerializer
      attributes :id, :inspection_id, :commodity_id, :quantity_received, :quantity_damaged, :quantity_lost,
                 :quality_status, :packaging_condition, :remarks, :created_at, :updated_at
    end
  end
end
