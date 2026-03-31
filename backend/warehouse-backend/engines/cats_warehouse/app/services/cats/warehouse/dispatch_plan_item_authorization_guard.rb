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

      # Matches Cats::Core::Dispatch#validate_dispatch_plan_status (cats_core gem): dispatches
      # require the parent plan header to be Approved, not only a Dispatchable plan item.
      def ensure_plan_approved_for_dispatch!
        plan = dispatch_plan_item.dispatch_plan
        return if plan&.status.to_s == Cats::Core::DispatchPlan::APPROVED

        raise ArgumentError, "Dispatch plan should be approved first."
      end

      def ensure_ready_for_dispatch_creation!
        ensure_dispatchable!
        ensure_plan_approved_for_dispatch!
      end

      private

      attr_reader :dispatch_plan_item
    end
  end
end
