module Cats
  module Warehouse
    class GrnPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          DocumentScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || storekeeper?
      end

      def confirm?
        return false unless record.is_a?(Grn)
        return false unless record.status.to_s.casecmp("draft").zero?

        return true if admin?

        return false unless warehouse_manager?

        assigned = AccessContext.new(user: user).assigned_warehouse_ids.map(&:to_i)
        assigned.include?(record.warehouse_id.to_i)
      end
    end
  end
end
