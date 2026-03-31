module Cats
  module Warehouse
    class WarehousePolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          FacilityScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || dispatch_planner? || hub_dispatch_officer? || hub_dispatch_approver? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || hub_manager?
      end

      def update?
        admin? || hub_manager? || warehouse_manager?
      end

      def destroy?
        admin?
      end
    end
  end
end
