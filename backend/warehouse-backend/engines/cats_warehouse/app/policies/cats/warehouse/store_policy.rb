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
        admin? || warehouse_manager?
      end

      def update?
        admin? || warehouse_manager?
      end

      def destroy?
        admin?
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
    end
  end
end
