module Cats
  module Warehouse
    class DispatchPlanSerializer < ApplicationSerializer
      attributes :id,
                 :reference_no,
                 :description,
                 :status,
                 :dispatchable_type,
                 :dispatchable_id,
                 :upstream,
                 :prepared_by_id,
                 :approved_by_id,
                 :created_at,
                 :updated_at

      has_many :dispatch_plan_items, serializer: DispatchPlanItemSerializer
    end
  end
end
