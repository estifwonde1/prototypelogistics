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

      def standalone_warehouse?(warehouse_id)
        Warehouse.where(id: warehouse_id, hub_id: nil).exists?
      end

      def can_create_receipt_authorization_for_warehouse?(warehouse_id)
        return true if admin?
        return true if hub_manager? && Warehouse.where(hub_id: assigned_hub_ids).exists?(id: warehouse_id)
        return true if warehouse_manager? &&
          assigned_warehouse_ids.include?(warehouse_id.to_i) &&
          standalone_warehouse?(warehouse_id)
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
        # Warehouse-level Storekeeper assignments only make the user available
        # for assignment by a manager. Store access is explicit per store.
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
        return Warehouse.pluck(:id) if admin? || officer_full_access?

        wids = []
        wids += Warehouse.where(hub_id: assigned_hub_ids).pluck(:id) if hub_manager?
        wids += assigned_warehouse_ids if warehouse_manager?
        wids += Warehouse.where(location_id: officer_location_scope_ids).pluck(:id) if officer?

        if storekeeper?
          wids += storekeeper_warehouse_ids
          wids += Store.where(id: assigned_store_ids).pluck(:warehouse_id)
        end

        Warehouse.where(id: wids.uniq.compact).pluck(:id)
      end

      def accessible_store_ids
        return Store.select(:id) if admin?
        # Warehouse Manager and Hub Manager take precedence over Storekeeper.
        # A user who holds both WM and Storekeeper roles must see all stores in
        # their managed warehouses, not just their Storekeeper assignments.
        return Store.where(warehouse_id: accessible_warehouse_ids).select(:id) if hub_manager? || warehouse_manager?
        # Storekeeper-only: restrict to assigned stores
        return assigned_store_ids if storekeeper?
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

      def can_access_store?(store_id)
        return true if admin?

        ids = accessible_store_ids
        if ids.is_a?(ActiveRecord::Relation)
          ids.where(id: store_id).exists?
        else
          Array(ids).map(&:to_i).include?(store_id.to_i)
        end
      end

      def can_access_warehouse?(warehouse_id)
        return true if admin?

        wid = warehouse_id.to_i
        return false if wid <= 0

        ids = accessible_warehouse_ids
        if ids.is_a?(ActiveRecord::Relation)
          ids.where(id: wid).exists?
        else
          Array(ids).map(&:to_i).include?(wid)
        end
      end
    end
  end
end
