module Cats
  module Warehouse
    class ReferenceDataPolicy < ApplicationPolicy
      def facility_options?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || inspector? || dispatcher?
      end

      def commodities?
        facility_options?
      end

      def units?
        facility_options?
      end
    end
  end
end
