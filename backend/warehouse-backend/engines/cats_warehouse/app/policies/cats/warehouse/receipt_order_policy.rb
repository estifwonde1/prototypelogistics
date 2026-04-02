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

      def destroy?
        update?
      end

      def assign?
        return true if admin?
        return true if officer?

        hub_manager? || warehouse_manager?
      end

      def assignable_managers?
        assign?
      end

      def reserve_space?
        return true if admin?
        return false unless record.is_a?(ReceiptOrder)

        if warehouse_manager?
          return accessible_warehouse_id_values.include?(record.warehouse_id.to_i)
        end

        return true if storekeeper?

        false
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

        accessible_warehouse_id_values.include?(record.warehouse_id.to_i)
      end

      private

      # AccessContext#accessible_warehouse_ids is an ActiveRecord::Relation for some roles, but for
      # Warehouse Manager it is already an Array<Integer> from UserAssignment — do not call .pluck(:id) on that.
      def accessible_warehouse_id_values
        raw = AccessContext.new(user: user).accessible_warehouse_ids
        if raw.is_a?(Array)
          raw.map { |v| v.is_a?(Integer) ? v : v.try(:id) }.compact.map(&:to_i)
        else
          raw.pluck(:id)
        end
      end

      def officer?
        user&.has_role?("Officer")
      end
    end
  end
end
