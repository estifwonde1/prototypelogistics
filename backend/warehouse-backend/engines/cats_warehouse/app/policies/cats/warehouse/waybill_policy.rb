module Cats
  module Warehouse
    class WaybillPolicy < ApplicationPolicy
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
        admin? || hub_manager? || warehouse_manager?
      end

      def confirm?
        admin? || hub_manager? || warehouse_manager?
      end

      private

      def officer?
        user&.has_role?("Officer")
      end
    end
  end
end
