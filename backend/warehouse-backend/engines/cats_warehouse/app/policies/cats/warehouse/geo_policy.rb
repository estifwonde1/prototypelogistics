module Cats
  module Warehouse
    class GeoPolicy < ApplicationPolicy
      def create?
        admin? || hub_manager? || warehouse_manager?
      end

      def update?
        create?
      end
    end
  end
end
