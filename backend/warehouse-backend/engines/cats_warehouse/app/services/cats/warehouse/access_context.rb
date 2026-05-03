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

      def receipt_authorizer?
        user&.has_role?("Receipt Authorizer")
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

      def assigned_receipt_authorizer_hub_ids
        UserAssignment.where(user_id: user&.id, role_name: "Receipt Authorizer").pluck(:hub_id).compact
      end

      def assigned_receipt_authorizer_warehouse_ids
        UserAssignment.where(user_id: user&.id, role_name: "Receipt Authorizer").pluck(:warehouse_id).compact
      end

      def can_create_receipt_authorization_for_warehouse?(warehouse_id)
        return true if admin?
        return true if hub_manager? && Warehouse.where(hub_id: assigned_hub_ids).exists?(id: warehouse_id)
        return true if warehouse_manager? && assigned_warehouse_ids.include?(warehouse_id.to_i)
        return true if receipt_authorizer? && (
          assigned_receipt_authorizer_warehouse_ids.include?(warehouse_id.to_i) ||
          Warehouse.where(hub_id: assigned_receipt_authorizer_hub_ids).exists?(id: warehouse_id)
        )

        false
      end

      def storekeeper_warehouse_ids
        UserAssignment.where(user_id: user&.id, role_name: "Storekeeper").pluck(:warehouse_id).compact
      end

      def assigned_store_ids
        # Get direct store-level assignments
        direct_store_ids = UserAssignment.where(user_id: user&.id, role_name: "Storekeeper").pluck(:store_id).compact
        
        # Get warehouse-level assignments and expand to all stores in those warehouses
        warehouse_ids = storekeeper_warehouse_ids
        warehouse_store_ids = warehouse_ids.present? ? Store.where(warehouse_id: warehouse_ids).pluck(:id) : []
        
        # Merge both: if user has specific store assignments, use those; otherwise use warehouse-level expansion
        if direct_store_ids.present?
          direct_store_ids
        else
          warehouse_store_ids
        end
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
        # Storekeeper can access warehouses from both direct warehouse assignments and store assignments
        return (storekeeper_warehouse_ids + Store.where(id: assigned_store_ids).select(:warehouse_id).pluck(:warehouse_id)).uniq if storekeeper?

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
