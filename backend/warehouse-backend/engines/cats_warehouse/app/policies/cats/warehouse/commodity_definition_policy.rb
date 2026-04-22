module Cats
  module Warehouse
    class CommodityDefinitionPolicy < ApplicationPolicy
      # Only admins can manage commodity definitions
      def index?
        admin?
      end

      def create?
        admin?
      end

      def update?
        admin?
      end

      def destroy?
        admin?
      end

      # All facility roles can read definitions (for dropdowns)
      def read?
        admin? || hub_manager? || warehouse_manager? || storekeeper? ||
          inspector? || dispatcher? || officer?
      end
    end
  end
end
