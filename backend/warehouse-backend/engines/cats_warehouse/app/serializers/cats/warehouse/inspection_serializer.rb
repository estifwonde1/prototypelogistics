module Cats
  module Warehouse
    class InspectionSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :inspected_on, :inspector_id, :source_type, :source_id,
                 :status, :created_at, :updated_at
      has_many :inspection_items, serializer: InspectionItemSerializer
    end
  end
end
