class AddStorekeeperAssignmentToDispatchOrderAuthorizations < ActiveRecord::Migration[7.0]
  def change
    return unless table_exists?(:cats_warehouse_dispatch_order_authorizations)

    add_column :cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_id, :bigint unless column_exists?(:cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_id)
    add_column :cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_by_id, :bigint unless column_exists?(:cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_by_id)
    add_column :cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_at, :datetime unless column_exists?(:cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_at)
    add_column :cats_warehouse_dispatch_order_authorizations, :store_id, :bigint unless column_exists?(:cats_warehouse_dispatch_order_authorizations, :store_id)
  end
end
