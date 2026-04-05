module Cats
  module Warehouse
    class StorekeeperAssignmentPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          scope.where(assigned_to_id: user.id)
               .or(scope.where(store_id: store_ids))
        end

        private

        def store_ids
          UserAssignment.where(user_id: user.id, role_name: "Storekeeper").pluck(:store_id)
        end
      end

      def index?
        storekeeper?
      end

      def accept?
        return false unless record.is_a?(ReceiptOrderAssignment)
        storekeeper? && accessible_assignment?
      end

      def reject?
        accept?
      end

      private

      def accessible_assignment?
        record.assigned_to_id == user.id || record.store_id.in?(store_ids)
      end

      def store_ids
        UserAssignment.where(user_id: user.id, role_name: "Storekeeper").pluck(:store_id)
      end
    end
  end
end
