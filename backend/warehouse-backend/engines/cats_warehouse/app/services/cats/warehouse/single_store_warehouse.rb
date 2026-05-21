# frozen_string_literal: true

module Cats
  module Warehouse
    # Warehouses with exactly one store skip WM storekeeper assignment;
    # RAs are broadcast to all eligible storekeepers instead.
    module SingleStoreWarehouse
      module_function

      def single_store?(warehouse_id)
        return false if warehouse_id.blank?

        Store.where(warehouse_id: warehouse_id).count == 1
      end

      def sole_store_id(warehouse_id)
        return nil unless single_store?(warehouse_id)

        Store.where(warehouse_id: warehouse_id).pick(:id)
      end

      def eligible_storekeeper_user_ids(warehouse_id)
        return [] if warehouse_id.blank?

        store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)
        assignments = UserAssignment
                        .includes(:user)
                        .where(role_name: "Storekeeper")
                        .where(
                          "warehouse_id = ? OR store_id IN (?)",
                          warehouse_id,
                          store_ids.presence || [0]
                        )

        assignments.filter_map { |ua| ua.user_id if ua.user&.active? }.uniq
      end

      def storekeeper_eligible?(user_id:, warehouse_id:)
        eligible_storekeeper_user_ids(warehouse_id).include?(user_id.to_i)
      end

      def single_store_warehouse_ids_for_user(access)
        wh_ids = Array(access.accessible_warehouse_ids).map(&:to_i).uniq
        wh_ids.select { |wid| single_store?(wid) }
      end
    end
  end
end
