module Cats
  module Warehouse
    class DispatchPlanPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          PlanningScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || dispatch_planner? || hub_manager? || warehouse_manager? || hub_dispatch_officer? || hub_dispatch_approver?
      end

      def show?
        index?
      end

      def create?
        admin? || dispatch_planner?
      end

      def update?
        admin? || dispatch_planner?
      end

      def approve?
        admin? || dispatch_planner? || hub_dispatch_approver?
      end
    end
  end
end
