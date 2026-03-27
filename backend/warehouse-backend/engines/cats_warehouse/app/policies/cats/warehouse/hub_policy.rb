module Cats
  module Warehouse
    class HubPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          FacilityScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager?
      end

      def show?
        index?
      end

      def create?
        admin?
      end

      def update?
        admin?
      end

      def destroy?
        admin?
      end
    end
  end
end
