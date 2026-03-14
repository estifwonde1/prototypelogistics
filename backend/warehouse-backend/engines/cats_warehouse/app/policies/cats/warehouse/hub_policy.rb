module Cats
  module Warehouse
    class HubPolicy < ApplicationPolicy
      def index?
        admin? || hub_manager?
      end

      def show?
        index?
      end

      def create?
        admin? || hub_manager?
      end

      def update?
        admin? || hub_manager?
      end

      def destroy?
        admin?
      end
    end
  end
end
