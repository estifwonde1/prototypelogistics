module Cats
  module Warehouse
    class AccessContext
      attr_reader :user

      def initialize(user:)
        @user = user
      end

      def admin?
        user&.has_role?("Admin") || user&.has_role?("Superadmin")
      end

      def hub_manager?
        user&.has_role?("Hub Manager")
      end

      def warehouse_manager?
        user&.has_role?("Warehouse Manager")
      end

      def storekeeper?
        user&.has_role?("Storekeeper")
      end

      def dispatch_planner?
        user&.has_role?("Dispatch Planner")
      end

      def hub_dispatch_officer?
        user&.has_role?("Hub Dispatch Officer")
      end

      def hub_dispatch_approver?
        user&.has_role?("Hub Dispatch Approver")
      end

      def assigned_hub_ids
        UserAssignment.where(user_id: user&.id, role_name: "Hub Manager").pluck(:hub_id).compact
      end

      def assigned_dispatch_hub_ids
        UserAssignment.where(user_id: user&.id, role_name: [ "Hub Dispatch Officer", "Hub Dispatch Approver" ]).pluck(:hub_id).compact
      end

      def assigned_warehouse_ids
        UserAssignment.where(user_id: user&.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
      end

      def assigned_store_ids
        UserAssignment.where(user_id: user&.id, role_name: "Storekeeper").pluck(:store_id).compact
      end

      def accessible_hub_ids
        return Hub.select(:id) if admin?
        return Hub.select(:id) if dispatch_planner?
        return assigned_hub_ids if hub_manager?
        return assigned_dispatch_hub_ids if hub_dispatch_officer? || hub_dispatch_approver?

        []
      end

      def accessible_warehouse_ids
        return Warehouse.select(:id) if admin?
        return Warehouse.select(:id) if dispatch_planner?
        return Warehouse.where(hub_id: assigned_hub_ids).select(:id) if hub_manager?
        return Warehouse.where(hub_id: assigned_dispatch_hub_ids).select(:id) if hub_dispatch_officer? || hub_dispatch_approver?
        return assigned_warehouse_ids if warehouse_manager?
        return Store.where(id: assigned_store_ids).select(:warehouse_id) if storekeeper?

        []
      end

      def accessible_store_ids
        return Store.select(:id) if admin?
        return Store.select(:id) if dispatch_planner?
        return Store.where(warehouse_id: accessible_warehouse_ids).select(:id) if hub_manager? || warehouse_manager?
        return assigned_store_ids if storekeeper?

        []
      end

      def accessible_stack_ids
        return Stack.select(:id) if admin?

        Stack.where(store_id: accessible_store_ids).select(:id)
      end
    end
  end
end
