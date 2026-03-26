module Cats
  module Warehouse
    class DispatchPolicy < ApplicationPolicy
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
    end
  end
end
