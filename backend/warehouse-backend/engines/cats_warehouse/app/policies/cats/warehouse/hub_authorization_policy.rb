module Cats
  module Warehouse
    class HubAuthorizationPolicy < ApplicationPolicy
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
        admin? || hub_manager? || hub_dispatch_officer? || hub_dispatch_approver?
      end
    end
  end
end
