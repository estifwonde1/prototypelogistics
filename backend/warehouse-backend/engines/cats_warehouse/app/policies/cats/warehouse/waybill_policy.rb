module Cats
  module Warehouse
    class WaybillPolicy < ApplicationPolicy
      def index?
        admin? || warehouse_manager? || dispatcher?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || dispatcher?
      end

      def confirm?
        admin? || warehouse_manager? || dispatcher?
      end
    end
  end
end
