# This migration comes from cats_warehouse (originally 20260401120000)
class ExtendCatsWarehouseOrdersForPhase1Closure < ActiveRecord::Migration[7.0]
  def change
    change_column_null :cats_warehouse_receipt_orders, :reference_no, true
    change_column_null :cats_warehouse_dispatch_orders, :reference_no, true

    add_column :cats_warehouse_receipt_orders, :name, :string unless column_exists?(:cats_warehouse_receipt_orders, :name)
    add_column :cats_warehouse_receipt_orders, :confirmed_at, :datetime unless column_exists?(:cats_warehouse_receipt_orders, :confirmed_at)

    add_column :cats_warehouse_dispatch_orders, :name, :string unless column_exists?(:cats_warehouse_dispatch_orders, :name)
    add_column :cats_warehouse_dispatch_orders, :confirmed_at, :datetime unless column_exists?(:cats_warehouse_dispatch_orders, :confirmed_at)
  end
end
