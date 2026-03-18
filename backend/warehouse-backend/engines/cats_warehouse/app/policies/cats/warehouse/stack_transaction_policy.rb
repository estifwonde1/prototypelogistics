module Cats
  module Warehouse
    class StackTransactionPolicy < ApplicationPolicy
      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end
    end
  end
end
