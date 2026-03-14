module Cats
  module Warehouse
    class StockBalancePolicy < ApplicationPolicy
      def index?
        admin? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end
    end
  end
end
