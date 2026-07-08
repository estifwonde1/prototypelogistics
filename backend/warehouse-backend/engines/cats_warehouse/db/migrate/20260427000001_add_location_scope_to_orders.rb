class AddLocationScopeToOrders < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_receipt_orders, :location_id, :bigint
    add_column :cats_warehouse_receipt_orders, :hierarchical_level, :string

    add_column :cats_warehouse_dispatch_orders, :location_id, :bigint
    add_column :cats_warehouse_dispatch_orders, :hierarchical_level, :string

    add_index :cats_warehouse_receipt_orders, :location_id
    add_index :cats_warehouse_receipt_orders, :hierarchical_level
    add_index :cats_warehouse_dispatch_orders, :location_id
    add_index :cats_warehouse_dispatch_orders, :hierarchical_level

    add_foreign_key :cats_warehouse_receipt_orders, :cats_core_locations, column: :location_id
    add_foreign_key :cats_warehouse_dispatch_orders, :cats_core_locations, column: :location_id
  end
end
