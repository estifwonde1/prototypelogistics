module Cats
  module Warehouse
    class DispatchOrderPolicy < ApplicationPolicy
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
        admin? || hub_manager? || warehouse_manager? || officer?
      end

      def update?
        return false unless record.is_a?(DispatchOrder)
        return false unless record.status_draft?

        create?
      end

      def assign?
        return true if admin?

        hub_manager? || warehouse_manager?
      end

      def reserve_stock?
        return true if admin?

        warehouse_manager? || storekeeper?
      end

      def workflow?
        show?
      end

      def confirm?
        return false unless record.is_a?(DispatchOrder)
        return false unless record.status.to_s.casecmp("draft").zero?

        return true if admin?
        return true if officer?  # Officers can confirm any order

        # For hub managers, check assigned hub IDs
        if hub_manager?
          assigned_hubs = AccessContext.new(user: user).assigned_hub_ids
          return assigned_hubs.include?(record.hub_id.to_i)
        end

        # For warehouse managers, check assigned warehouse IDs
        return false unless warehouse_manager?

        raw = AccessContext.new(user: user).accessible_warehouse_ids
        warehouse_ids =
          if raw.is_a?(Array)
            raw.map { |v| v.is_a?(Integer) ? v : v.try(:id) }.compact.map(&:to_i)
          else
            raw.pluck(:id)
          end
        warehouse_ids.include?(record.warehouse_id.to_i)
      end

      private

      def officer?
        user&.has_role?("Officer")
      end
    end
  end
end
