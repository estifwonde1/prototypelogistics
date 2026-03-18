module Cats
  module Warehouse
    class GinPolicy < ApplicationPolicy
      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || storekeeper?
      end

      def confirm?
        admin? || warehouse_manager?
      end
    end
  end
end
