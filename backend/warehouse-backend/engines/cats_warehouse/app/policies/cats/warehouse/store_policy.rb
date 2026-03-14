module Cats
  module Warehouse
    class StorePolicy < ApplicationPolicy
      def index?
        admin? || warehouse_manager? || storekeeper?
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
    end
  end
end
