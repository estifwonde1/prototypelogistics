module Cats
  module Warehouse
    class StackPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          FacilityScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def update?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def destroy?
        admin?
      end
    end
  end
end
