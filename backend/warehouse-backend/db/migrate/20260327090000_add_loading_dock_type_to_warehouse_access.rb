class AddLoadingDockTypeToWarehouseAccess < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_warehouse_access, :loading_dock_type, :string
  end
end
