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

        def storekeeper_scope(_access)
          tbl = DispatchOrderAuthorization.table_name
          sk_wh_ids = storekeeper_warehouse_ids_for_user
          return scope.none if sk_wh_ids.empty?

          eligible_wh_ids =
            sk_wh_ids.select do |wid|
              SingleStoreWarehouse.storekeeper_eligible?(user_id: user.id, warehouse_id: wid)
            end
          return scope.none if eligible_wh_ids.empty?

          assigned_ids =
            scope
              .where(assigned_storekeeper_id: user.id, status: DispatchOrderAuthorization::CONFIRMED)
              .select(:id)
          open_ids =
            scope
              .where(
                "#{tbl}.assigned_storekeeper_id IS NULL AND #{tbl}.warehouse_id IN (?)",
                eligible_wh_ids
              )
              .where(status: DispatchOrderAuthorization::CONFIRMED)
              .select(:id)

          scope.where(id: assigned_ids).or(scope.where(id: open_ids))
        end

        def storekeeper_warehouse_ids_for_user
          direct_wh =
            UserAssignment.where(user_id: user.id, role_name: "Storekeeper").pluck(:warehouse_id).compact.map(&:to_i)
          direct_store_ids =
            UserAssignment.where(user_id: user.id, role_name: "Storekeeper").pluck(:store_id).compact.map(&:to_i)
          store_wh =
            if direct_store_ids.present?
              Store.where(id: direct_store_ids).distinct.pluck(:warehouse_id).map(&:to_i)
            else
              []
            end
          (direct_wh + store_wh).uniq
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

      def driver_confirm?
        return false unless record.is_a?(DispatchOrderAuthorization)
        return false unless record.confirmed?

        return true if admin?

        if storekeeper?
          return record.assigned_storekeeper_id == user.id ||
                 SingleStoreWarehouse.storekeeper_eligible?(user_id: user.id, warehouse_id: record.warehouse_id.to_i)
        end

        false
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
