module Cats
  module Warehouse
    class DispatchPlanItemAuthorizationGuard
      def initialize(dispatch_plan_item:)
        @dispatch_plan_item = dispatch_plan_item
      end

      def ensure_dispatchable!
        return if dispatch_plan_item.status.to_s == DispatchPlanItem::STATUS_DISPATCHABLE

        raise ArgumentError, "Dispatch plan item must be fully authorized before execution"
      end

      private

      attr_reader :dispatch_plan_item
    end
  end
end
