# This migration is local to the warehouse backend app.
class CreateCatsWarehouseUserAssignments < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_user_assignments do |t|
      t.references :user, null: false, foreign_key: { to_table: :cats_core_users }
      t.references :hub, foreign_key: { to_table: :cats_warehouse_hubs }
      t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :store, foreign_key: { to_table: :cats_warehouse_stores }
      t.string :role_name

      t.timestamps
    end

    # Shortened index names to avoid PostgreSQL 63-character limit
    add_index :cats_warehouse_user_assignments, [:user_id, :hub_id],
              unique: true,
              where: "hub_id IS NOT NULL",
              name: "idx_cwua_user_hub"

    add_index :cats_warehouse_user_assignments, [:user_id, :warehouse_id],
              unique: true,
              where: "warehouse_id IS NOT NULL",
              name: "idx_cwua_user_warehouse"

    add_index :cats_warehouse_user_assignments, [:user_id, :store_id],
              unique: true,
              where: "store_id IS NOT NULL",
              name: "idx_cwua_user_store"
  end
end