class HubAuthorizationSerializer < ActiveModel::Serializer
  attributes :id, :quantity, :authorization_type, :authorized_by_id, :authorized_by_full_name, :store_id, :store_name,
             :dispatch_plan_item_id, :plan_reference_no, :unit_id, :unit_abbreviation
end
