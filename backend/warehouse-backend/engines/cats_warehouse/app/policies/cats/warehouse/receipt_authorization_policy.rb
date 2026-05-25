module Cats
  module Warehouse
    class ReceiptAuthorizationPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)

          return scope.all if access.admin?

          # Users may hold multiple roles (e.g. Warehouse Manager + Storekeeper). Union each
          # role's visibility so storekeeper notifications and WM lists both work.
          parts = []
          parts << hub_manager_scope(access) if access.hub_manager?
          parts << warehouse_manager_scope(access) if access.warehouse_manager?
          parts << storekeeper_scope(access) if access.storekeeper?
          parts << officer_scope(access) if access.officer?
          parts << receipt_authorizer_scope(access) if access.receipt_authorizer?

          return scope.none if parts.empty?
          return parts.first if parts.length == 1

          parts.reduce { |combined, part| combined.or(part) }
        end

        private

        def hub_manager_scope(access)
          hub_ids = access.assigned_hub_ids
          warehouse_ids = Warehouse.where(hub_id: hub_ids).pluck(:id)
          scope.where(warehouse_id: warehouse_ids)
        end

        def warehouse_manager_scope(access)
          role_wh_ids = Array(access.assigned_warehouse_ids).map(&:to_i).uniq
          roa_t       = ReceiptOrderAssignment.table_name
          assignee_wh_ids =
            ReceiptOrderAssignment
              .where(assigned_to_id: user.id)
              .where.not(warehouse_id: nil)
              .where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")
              .distinct
              .pluck(:warehouse_id)
              .map(&:to_i)
          visible_wh_ids = (role_wh_ids + assignee_wh_ids).uniq
          return scope.none if visible_wh_ids.empty?

          scope.where(warehouse_id: visible_wh_ids)
        end

        def storekeeper_scope(access)
          tbl = ReceiptAuthorization.table_name
          sk_wh_ids = storekeeper_warehouse_ids_for_user
          return scope.none if sk_wh_ids.empty?

          eligible_wh_ids =
            sk_wh_ids.select do |wid|
              SingleStoreWarehouse.storekeeper_eligible?(user_id: user.id, warehouse_id: wid)
            end
          return scope.none if eligible_wh_ids.empty?

          assigned_ids = scope.where(assigned_storekeeper_id: user.id).select(:id)
          open_ids = scope.where(
            "#{tbl}.assigned_storekeeper_id IS NULL AND #{tbl}.warehouse_id IN (?)",
            eligible_wh_ids
          ).select(:id)

          scope.where(id: assigned_ids).or(scope.where(id: open_ids))
        end

        # Do not use AccessContext#accessible_warehouse_ids here — it prefers Hub/WM roles
        # and returns [] or the wrong warehouses when the user also holds those roles.
        def storekeeper_warehouse_ids_for_user
          direct_wh = UserAssignment.where(user_id: user.id, role_name: "Storekeeper").pluck(:warehouse_id).compact.map(&:to_i)
          direct_store_ids = UserAssignment.where(user_id: user.id, role_name: "Storekeeper").pluck(:store_id).compact.map(&:to_i)
          store_wh =
            if direct_store_ids.present?
              Store.where(id: direct_store_ids).distinct.pluck(:warehouse_id).map(&:to_i)
            else
              []
            end
          (direct_wh + store_wh).uniq
        end

        def officer_scope(_access)
          wh_ids =
            if _access.officer_full_access?
              Warehouse.pluck(:id)
            else
              Warehouse.where(location_id: _access.officer_location_scope_ids).pluck(:id)
            end
          return scope.none if wh_ids.empty?

          scope.where(warehouse_id: wh_ids)
        end

        def receipt_authorizer_scope(access)
          wh_ids = access.assigned_receipt_authorizer_warehouse_ids
          hub_wh_ids = Warehouse.where(hub_id: access.assigned_receipt_authorizer_hub_ids).pluck(:id)
          scope.where(warehouse_id: (wh_ids + hub_wh_ids).uniq)
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || receipt_authorizer? || storekeeper? || officer?
      end

      def show?
        return false unless record.is_a?(ReceiptAuthorization)

        Scope.new(user, ReceiptAuthorization.all).resolve.where(id: record.id).exists?
      end

      def create?
        return true if admin? || hub_manager? || receipt_authorizer?
        return false unless warehouse_manager?

        # Class-level authorize; controller enforces destination warehouse via create_for_warehouse?
        warehouse_manager?
      end

      def create_for_warehouse?(warehouse_id)
        return false if warehouse_id.blank?

        access.can_create_receipt_authorization_for_warehouse?(warehouse_id)
      end

      def update?
        return false unless record.is_a?(ReceiptAuthorization)
        return false unless record.pending?

        can_mutate?
      end

      def cancel?
        return false unless record.is_a?(ReceiptAuthorization)
        return false unless record.pending?
        return false if record.inspections.any?

        can_mutate?
      end

      def assignable_storekeepers?
        index?
      end

      def assign_storekeeper?
        return false unless record.is_a?(ReceiptAuthorization)
        return false if SingleStoreWarehouse.single_store?(record.warehouse_id)
        return false unless access.warehouse_manager?

        wh_ids = access.assigned_warehouse_ids.map(&:to_i)
        return false unless wh_ids.include?(record.warehouse_id.to_i)

        return false unless record.pending? || record.active?
        return false if record.inspections.exists?

        true
      end

      def driver_confirm?
        return false unless record.is_a?(ReceiptAuthorization)
        return true if admin?

        return false unless access.storekeeper?

        return true if record.assigned_storekeeper_id == user.id

        record.assigned_storekeeper_id.blank? &&
          SingleStoreWarehouse.storekeeper_eligible?(user_id: user.id, warehouse_id: record.warehouse_id)
      end

      private

      def access
        @access ||= AccessContext.new(user: user)
      end

      def can_mutate?
        return true if admin? || hub_manager? || receipt_authorizer?
        return false unless warehouse_manager?
        return false unless record.is_a?(ReceiptAuthorization)

        access.can_create_receipt_authorization_for_warehouse?(record.warehouse_id)
      end

      def receipt_authorizer?
        access.receipt_authorizer?
      end
    end
  end
end
