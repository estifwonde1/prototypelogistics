class RefactorCatsWarehouseOwnershipFields < ActiveRecord::Migration[7.0]
  def change
    remove_index :cats_warehouse_warehouses, :ownership_type if index_exists?(:cats_warehouse_warehouses, :ownership_type)

    rename_column :cats_warehouse_warehouses, :ownership_type, :managed_under
    add_index :cats_warehouse_warehouses, :managed_under

    add_column :cats_warehouse_warehouses, :ownership_type, :string, null: false, default: "self_owned"
    add_index :cats_warehouse_warehouses, :ownership_type
  end
end
