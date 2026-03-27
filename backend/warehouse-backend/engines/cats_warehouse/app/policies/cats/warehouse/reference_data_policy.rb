module Cats
  module Warehouse
    class ReferenceDataPolicy < ApplicationPolicy
      def facility_options?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || inspector? || dispatcher?
      end
    end
  end
end
