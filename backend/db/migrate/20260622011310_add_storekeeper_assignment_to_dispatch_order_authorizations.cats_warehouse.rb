class AddStorekeeperAssignmentToDispatchOrderAuthorizations < ActiveRecord::Migration[8.0]
  def change
    add_column :cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_id, :bigint
    add_column :cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_by_id, :bigint
    add_column :cats_warehouse_dispatch_order_authorizations, :assigned_storekeeper_at, :datetime
    add_column :cats_warehouse_dispatch_order_authorizations, :store_id, :bigint
  end
end
