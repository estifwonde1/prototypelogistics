module Cats
  module Warehouse
    class StorePolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          FacilityScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || officer?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || hub_manager?
      end

      def update?
        admin? || warehouse_manager? || hub_manager?
      end

      def destroy?
        return false unless record.is_a?(Store)
        return false if store_has_stock?

        return true if admin?

        (warehouse_manager? || hub_manager?) && can_manage_store?
      end

      def storekeepers?
        admin? || warehouse_manager?
      end

      def assign_storekeeper?
        admin? || warehouse_manager?
      end

      private

      def officer?
        super
      end

      def can_manage_store?
        AccessContext.new(user: user).can_access_warehouse?(record.warehouse_id)
      end

      def store_has_stock?
        CapacityUsage.for_store(record).used_mt.positive?
      end
    end
  end
end
