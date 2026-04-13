module Cats
  module Warehouse
    class GinPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          DocumentScopeQuery.new(user: user, scope: scope).call
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

      def confirm?
        admin? || warehouse_manager?
      end

      private

      def officer?
        super
      end
    end
  end
end
