module Cats
  module Warehouse
    class AccessContext
      include ContractConstants
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
        OFFICER_ROLE_NAMES.any? { |role| user&.has_role?(role) }
      end

      def officer_full_access?
        return false unless officer?

        user&.has_role?("Officer") || user&.has_role?("Federal Officer")
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

      def officer_location_ids
        UserAssignment
          .where(user_id: user&.id, role_name: officer_location_role_names)
          .pluck(:location_id)
          .compact
      end

      def officer_location_scope_ids
        ids = officer_location_ids
        return [] if ids.blank?

        Cats::Core::Location.where(id: ids).flat_map(&:subtree_ids).compact.uniq
      end

      def accessible_hub_ids
        return Hub.select(:id) if admin?
        return assigned_hub_ids if hub_manager?
        return Hub.select(:id) if officer_full_access?
        return Hub.where(location_id: officer_location_scope_ids).select(:id) if officer?

        []
      end

      def accessible_warehouse_ids
        return Warehouse.select(:id) if admin?
        # Hub Manager before Warehouse Manager: hub users only see warehouses under their assigned hub(s),
        # not standalone warehouses tied only to a Warehouse Manager assignment.
        return Warehouse.where(hub_id: assigned_hub_ids).select(:id) if hub_manager?
        return assigned_warehouse_ids if warehouse_manager?
        return Warehouse.select(:id) if officer_full_access?
        return Warehouse.where(location_id: officer_location_scope_ids).select(:id) if officer?
        return Store.where(id: assigned_store_ids).select(:warehouse_id) if storekeeper?

        []
      end

      def accessible_store_ids
        return Store.select(:id) if admin?
        # Storekeeper role takes precedence - they should only see their assigned stores
        # even if they have other roles like Officer
        return assigned_store_ids if storekeeper?
        return Store.where(warehouse_id: accessible_warehouse_ids).select(:id) if hub_manager? || warehouse_manager?
        return Store.where(warehouse_id: accessible_warehouse_ids).select(:id) if officer?

        []
      end

      def officer_location_role_names
        OFFICER_ROLE_NAMES - ["Officer", "Federal Officer"]
      end

      def accessible_stack_ids
        return Stack.select(:id) if admin?

        Stack.where(store_id: accessible_store_ids).select(:id)
      end
    end
  end
end
