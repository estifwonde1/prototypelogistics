class AddOwnershipTypeToCatsWarehouseWarehouses < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_warehouses, :ownership_type, :string
    add_index :cats_warehouse_warehouses, :ownership_type
  end
end
