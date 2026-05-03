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
            return scope.where(warehouse_id: access.assigned_warehouse_ids)
          end

          if access.receipt_authorizer?
            wh_ids = access.assigned_receipt_authorizer_warehouse_ids
            hub_wh_ids = Warehouse.where(hub_id: access.assigned_receipt_authorizer_hub_ids).pluck(:id)
            return scope.where(warehouse_id: (wh_ids + hub_wh_ids).uniq)
          end

          if access.storekeeper?
            store_ids = access.assigned_store_ids
            return scope.where(store_id: store_ids, status: ReceiptAuthorization::PENDING)
          end

          scope.none
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || receipt_authorizer? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || hub_manager? || warehouse_manager? || receipt_authorizer?
      end

      def update?
        return false unless record.is_a?(ReceiptAuthorization)
        return false unless record.pending?

        create?
      end

      def cancel?
        return false unless record.is_a?(ReceiptAuthorization)
        return false unless record.pending?
        return false if record.inspection.present?

        create?
      end

      def driver_confirm?
        return false unless record.is_a?(ReceiptAuthorization)

        admin? || storekeeper?
      end

      private

      def receipt_authorizer?
        AccessContext.new(user: user).receipt_authorizer?
      end
    end
  end
end
