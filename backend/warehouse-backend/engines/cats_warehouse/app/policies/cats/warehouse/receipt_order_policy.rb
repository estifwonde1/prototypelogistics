module Cats
  module Warehouse
    class ReceiptOrderPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          DocumentScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || officer?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || officer?
      end

      def update?
        return false unless record.is_a?(ReceiptOrder)
        return false unless record.status_draft?

        create?
      end

      def assign?
        return true if admin?

        hub_manager? || warehouse_manager?
      end

      def reserve_space?
        return true if admin?

        warehouse_manager? || storekeeper?
      end

      def workflow?
        show?
      end

      def confirm?
        return false unless record.is_a?(ReceiptOrder)
        return false unless record.status.to_s.casecmp("draft").zero?

        return true if admin?
        return true if officer?  # Officers can confirm any order
        return false unless warehouse_manager?

        assigned = AccessContext.new(user: user).accessible_warehouse_ids.pluck(:id)
        assigned.include?(record.warehouse_id.to_i)
      end

      private

      def officer?
        user&.has_role?("Officer")
      end
    end
  end
end
