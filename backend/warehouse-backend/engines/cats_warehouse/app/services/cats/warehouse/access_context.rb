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

      def officer?
        user&.has_role?("Officer")
      end

      def assigned_hub_ids
        UserAssignment.where(user_id: user&.id, role_name: "Hub Manager").pluck(:hub_id).compact
      end

      def assigned_warehouse_ids
        UserAssignment.where(user_id: user&.id, role_name: "Warehouse Manager").pluck(:warehouse_id).compact
      end

      def assigned_store_ids
        UserAssignment.where(user_id: user&.id, role_name: "Storekeeper").pluck(:store_id).compact
      end

      def assigned_officer_warehouse_ids
        UserAssignment.where(user_id: user&.id, role_name: "Officer").pluck(:warehouse_id).compact
      end

      def accessible_hub_ids
        return Hub.select(:id) if admin?
        return assigned_hub_ids if hub_manager?

        []
      end

      def accessible_warehouse_ids
        return Warehouse.select(:id) if admin?
        return Warehouse.where(hub_id: assigned_hub_ids).select(:id) if hub_manager?
        return assigned_warehouse_ids if warehouse_manager?
        return assigned_officer_warehouse_ids if officer?
        return Store.where(id: assigned_store_ids).select(:warehouse_id) if storekeeper?

        []
      end

      def accessible_store_ids
        return Store.select(:id) if admin?
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
