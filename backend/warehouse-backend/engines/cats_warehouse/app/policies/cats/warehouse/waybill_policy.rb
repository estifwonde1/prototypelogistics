module Cats
  module Warehouse
    class WaybillPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          DocumentScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || hub_manager? || warehouse_manager? || dispatch_planner? || hub_dispatch_officer?
      end

      def confirm?
        admin? || hub_manager? || warehouse_manager? || hub_dispatch_officer? || hub_dispatch_approver?
      end
    end
  end
end
