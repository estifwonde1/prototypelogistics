module Cats
  module Warehouse
    class DispatchOrderAuthorizationPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)

          return scope.all if access.admin?

          parts = []
          parts << hub_manager_scope(access)       if access.hub_manager?
          parts << warehouse_manager_scope(access) if access.warehouse_manager?
          parts << officer_scope(access)           if access.officer?
          parts << storekeeper_scope(access)       if access.storekeeper?

          return scope.none if parts.empty?
          return parts.first if parts.length == 1

          parts.reduce { |combined, part| combined.or(part) }
        end

        private

        def hub_manager_scope(access)
          hub_ids = access.assigned_hub_ids
          wh_ids  = Warehouse.where(hub_id: hub_ids).pluck(:id)
          scope.where(warehouse_id: wh_ids)
        end

        def warehouse_manager_scope(access)
          wh_ids = Array(access.assigned_warehouse_ids).map(&:to_i).uniq
          scope.where(warehouse_id: wh_ids)
        end

        def officer_scope(_access)
          scope.all
        end

        def storekeeper_scope(access)
          # Storekeepers see DAs for their warehouse (via their store)
          store_ids  = access.assigned_store_ids
          wh_ids     = Store.where(id: store_ids).pluck(:warehouse_id).compact.uniq
          scope.where(warehouse_id: wh_ids)
        end
      end

      def index?
        access = AccessContext.new(user: user)

        return true if access.admin?
        return true if access.hub_manager?
        return true if access.warehouse_manager?
        return true if officer?
        return true if independent_warehouse_manager?
        return true if storekeeper?

        false
      end

      def show?
        return false unless record.is_a?(DispatchOrderAuthorization)

        Scope.new(user, DispatchOrderAuthorization.all).resolve.where(id: record.id).exists?
      end

      def create?
        access = AccessContext.new(user: user)

        return true if access.admin?
        return true if access.hub_manager?
        return true if access.warehouse_manager?
        return true if independent_warehouse_manager?

        false
      end

      def assignable_storekeepers?
        access = AccessContext.new(user: user)

        return true if access.admin?
        return true if access.warehouse_manager?
        return true if independent_warehouse_manager?

        false
      end

      def update?
        return false unless record.is_a?(DispatchOrderAuthorization)
        return false unless record.draft?

        create?
      end

      def confirm?
        return false unless record.is_a?(DispatchOrderAuthorization)
        return false unless record.draft?

        if hub_manager?
          access = AccessContext.new(user: user)
          hub_ids = access.assigned_hub_ids.map(&:to_i)
          wh_hub = record.warehouse&.hub_id.to_i
          return hub_ids.include?(wh_hub)
        end

        if warehouse_manager? || independent_warehouse_manager?
          access = AccessContext.new(user: user)
          wh_ids = Array(access.assigned_warehouse_ids).map(&:to_i)
          return wh_ids.include?(record.warehouse_id.to_i)
        end

        admin?
      end

      def cancel?
        return false unless record.is_a?(DispatchOrderAuthorization)
        return false unless record.draft?

        create?
      end

      def assign_storekeeper?
        return false unless record.is_a?(DispatchOrderAuthorization)

        if warehouse_manager? || independent_warehouse_manager?
          access = AccessContext.new(user: user)
          wh_ids = Array(access.assigned_warehouse_ids).map(&:to_i)
          return wh_ids.include?(record.warehouse_id.to_i)
        end

        admin?
      end

      private

      def independent_warehouse_manager?
        user&.has_role?("Independent Warehouse Manager")
      end
    end
  end
end
