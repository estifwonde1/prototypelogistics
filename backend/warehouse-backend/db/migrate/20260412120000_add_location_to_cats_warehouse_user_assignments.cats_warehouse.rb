class AddLocationToCatsWarehouseUserAssignments < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_user_assignments, :location_id, :bigint
    add_index :cats_warehouse_user_assignments, :location_id
    add_foreign_key :cats_warehouse_user_assignments, :cats_core_locations, column: :location_id
  end
end
