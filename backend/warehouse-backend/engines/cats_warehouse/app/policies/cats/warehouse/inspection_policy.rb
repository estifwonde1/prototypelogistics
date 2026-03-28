module Cats
  module Warehouse
    class InspectionPolicy < ApplicationPolicy
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
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def confirm?
        admin? || hub_manager? || warehouse_manager?
      end
    end
  end
end
