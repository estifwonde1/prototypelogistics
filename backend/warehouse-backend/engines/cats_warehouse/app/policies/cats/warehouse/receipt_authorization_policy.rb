module Cats
  module Warehouse
    class ReceiptAuthorizationPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)

          return scope.all if access.admin?

          if access.hub_manager?
            hub_ids = access.assigned_hub_ids
            warehouse_ids = Warehouse.where(hub_id: hub_ids).pluck(:id)
            return scope.where(warehouse_id: warehouse_ids)
          end

          if access.warehouse_manager?
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

            return scope.where(warehouse_id: visible_wh_ids)
          end

          # IMPORTANT: prioritize storekeeper scope before officer/other role scopes.
          # Some users can carry multiple roles; inspection flow must use the storekeeper
          # visibility rules when acting as storekeeper.
          if access.storekeeper?
            tbl = ReceiptAuthorization.table_name
            single_store_wh_ids = SingleStoreWarehouse.single_store_warehouse_ids_for_user(access)
            assigned_scope = scope.where(assigned_storekeeper_id: user.id)
            if single_store_wh_ids.empty?
              return assigned_scope
            end

            open_scope = scope.where(
              "#{tbl}.assigned_storekeeper_id IS NULL AND #{tbl}.warehouse_id IN (?)",
              single_store_wh_ids
            )
            return assigned_scope.or(open_scope)
          end

          if access.officer?
            return scope.where(warehouse_id: access.accessible_warehouse_ids)
          end

          if access.receipt_authorizer?
            wh_ids = access.assigned_receipt_authorizer_warehouse_ids
            hub_wh_ids = Warehouse.where(hub_id: access.assigned_receipt_authorizer_hub_ids).pluck(:id)
            return scope.where(warehouse_id: (wh_ids + hub_wh_ids).uniq)
          end

          scope.none
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || receipt_authorizer? || storekeeper? || officer?
      end

      def show?
        index?
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
          SingleStoreWarehouse.single_store?(record.warehouse_id) &&
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
