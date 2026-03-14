module Cats
  module Warehouse
    class InspectionPolicy < ApplicationPolicy
      def index?
        admin? || warehouse_manager? || inspector?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || inspector?
      end

      def confirm?
        admin? || warehouse_manager? || inspector?
      end
    end
  end
end
