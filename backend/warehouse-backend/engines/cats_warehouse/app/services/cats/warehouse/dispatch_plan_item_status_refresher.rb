module Cats
  module Warehouse
    class DispatchPlanItemStatusRefresher
      def initialize(dispatch_plan_item:)
        @dispatch_plan_item = dispatch_plan_item
      end

      def call
        has_source = dispatch_plan_item.hub_authorizations.exists?(authorization_type: HubAuthorization::AUTHORIZATION_SOURCE)
        has_destination = dispatch_plan_item.hub_authorizations.exists?(authorization_type: HubAuthorization::AUTHORIZATION_DESTINATION)

        next_status =
          if has_source && has_destination
            DispatchPlanItem::STATUS_DISPATCHABLE
          elsif has_source
            DispatchPlanItem::STATUS_SOURCE_AUTHORIZED
          elsif has_destination
            DispatchPlanItem::STATUS_DESTINATION_AUTHORIZED
          else
            DispatchPlanItem::STATUS_UNAUTHORIZED
          end

        dispatch_plan_item.update!(status: next_status) if dispatch_plan_item.status != next_status
        dispatch_plan_item
      end

      private

      attr_reader :dispatch_plan_item
    end
  end
end
