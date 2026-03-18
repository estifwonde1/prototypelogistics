module Cats
  module Warehouse
    class ReceiptPolicy < ApplicationPolicy
      def index?
        admin? || hub_manager? || warehouse_manager?
      end

      def show?
        index?
      end
    end
  end
end
