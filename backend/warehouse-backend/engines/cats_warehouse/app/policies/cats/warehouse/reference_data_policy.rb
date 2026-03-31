module Cats
  module Warehouse
    class ReferenceDataPolicy < ApplicationPolicy
      def facility_options?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || inspector? || dispatcher? || dispatch_planner? || hub_dispatch_officer? || hub_dispatch_approver?
      end

      def commodities?
        facility_options?
      end

      def units?
        facility_options?
      end

      def transporters?
        facility_options?
      end
    end
  end
end
