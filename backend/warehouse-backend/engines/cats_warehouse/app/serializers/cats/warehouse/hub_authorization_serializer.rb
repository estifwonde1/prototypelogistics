module Cats
  module Warehouse
    class HubAuthorizationSerializer < ApplicationSerializer
      attributes :id,
                 :dispatch_plan_item_id,
                 :store_id,
                 :quantity,
                 :unit_id,
                 :authorization_type,
                 :authorized_by_id,
                 :created_at,
                 :updated_at
    end
  end
end
