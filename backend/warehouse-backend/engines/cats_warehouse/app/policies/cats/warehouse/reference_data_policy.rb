module Cats
  module Warehouse
    class ReferenceDataPolicy < ApplicationPolicy
      def facility_options?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || inspector? || dispatcher? || officer?
      end

      def commodities?
        facility_options?
      end

      def create_commodity?
        officer? || admin?
      end

      def units?
        facility_options?
      end

      def transporters?
        facility_options?
      end

      def inventory_lots?
        facility_options?
      end

      def uom_conversions?
        facility_options?
      end

      private

      def officer?
        user&.has_role?("Officer")
      end
    end
  end
end
