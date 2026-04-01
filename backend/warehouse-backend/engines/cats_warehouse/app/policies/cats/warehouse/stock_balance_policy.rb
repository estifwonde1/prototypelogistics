module Cats
  module Warehouse
    class StockBalancePolicy < ApplicationPolicy
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

      private

      def officer?
        user&.has_role?("Officer")
      end
    end
  end
end
