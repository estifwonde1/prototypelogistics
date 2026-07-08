module Cats
  module Warehouse
    class StackPolicy < ApplicationPolicy
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
        admin? || warehouse_manager? || storekeeper?
      end

      def update?
        admin? || warehouse_manager? || storekeeper?
      end

      def destroy?
        admin?
      end

      def transfer?
        admin? || warehouse_manager? || storekeeper?
      end

      private

      def officer?
        super
      end
    end
  end
end
