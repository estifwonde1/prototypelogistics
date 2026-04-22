module Cats
  module Warehouse
    class StockBalancePolicy < ApplicationPolicy
      class Scope < Scope
        include ContractConstants
        def resolve
          ac = AccessContext.new(user: user)
          return scope.all if admin? || ac.officer_full_access?

          warehouse_ids = ac.accessible_warehouse_ids

          # Handle empty arrays - return no results if user has no accessible warehouses
          if warehouse_ids.is_a?(Array) && warehouse_ids.empty?
            return scope.none
          end

          scope.where(warehouse_id: warehouse_ids)
        end

        private

        def admin?
          user&.has_role?("Admin") || user&.has_role?("Superadmin")
        end

        def officer?
          OFFICER_ROLE_NAMES.any? { |role| user&.has_role?(role) }
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || officer?
      end

      def show?
        index?
      end

      private

      def officer?
        super
      end
    end
  end
end
