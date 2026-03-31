module Cats
  module Warehouse
    class DispatchPlanItemSerializer < ApplicationSerializer
      attributes :id,
                 :reference_no,
                 :dispatch_plan_id,
                 :source_id,
                 :destination_id,
                 :commodity_id,
                 :quantity,
                 :unit_id,
                 :commodity_status,
                 :status,
                 :beneficiaries,
                 :created_at,
                 :updated_at

      has_many :hub_authorizations, serializer: HubAuthorizationSerializer

      def source_name
        object.source&.name
      end

      def destination_name
        object.destination&.name
      end
    end
  end
end
