module Cats
  module Warehouse
    class GinPolicy < ApplicationPolicy
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
        admin? || warehouse_manager? || storekeeper?
      end

      def confirm?
        return false unless record.is_a?(Gin)

        return authorize_dispatch_gin_action? if record.status.to_s.casecmp("confirmed").zero?

        return false unless record.status.to_s.casecmp("draft").zero?

        authorize_dispatch_gin_action?
      end

      def stack_allocations?
        return false unless record.is_a?(Gin)
        return false unless record.status.to_s.casecmp("draft").zero?

        authorize_dispatch_gin_action?
      end

      private

      def authorize_dispatch_gin_action?
        return true if admin? || warehouse_manager?
        return false unless storekeeper?

        # Outbound dispatch v2: storekeeper allocates stacks and confirms the GIN.
        record.dispatch_order_authorization_id.present? && gin_warehouse_accessible?
      end

      def gin_warehouse_accessible?
        wh_ids = AccessContext.new(user: user).accessible_warehouse_ids
        list = wh_ids.is_a?(ActiveRecord::Relation) ? wh_ids.pluck(:id) : Array(wh_ids).map(&:to_i)
        list.include?(record.warehouse_id.to_i)
      end

      def officer?
        super
      end
    end
  end
end
