class ReplaceUserAssignmentUniqueIndexesWithRoleAware < ActiveRecord::Migration[7.0]
  def up
    # ── Drop the old role-agnostic unique indexes ──────────────────────────────
    # These prevented a user from holding two different roles at the same
    # warehouse/hub/store (e.g. Warehouse Manager + Storekeeper at the same
    # warehouse), which is a valid multi-role scenario.
    remove_index :cats_warehouse_user_assignments, name: "idx_cwua_user_warehouse"
    remove_index :cats_warehouse_user_assignments, name: "idx_cwua_user_hub"
    remove_index :cats_warehouse_user_assignments, name: "idx_cwua_user_store"

    # ── Add role-aware unique indexes ──────────────────────────────────────────
    # A user may hold at most one assignment per (role, warehouse/hub/store).
    # This still prevents duplicate assignments of the same role to the same
    # facility while allowing different roles at the same facility.
    add_index :cats_warehouse_user_assignments,
              [:user_id, :role_name, :warehouse_id],
              unique: true,
              where: "warehouse_id IS NOT NULL",
              name: "idx_cwua_user_role_warehouse"

    add_index :cats_warehouse_user_assignments,
              [:user_id, :role_name, :hub_id],
              unique: true,
              where: "hub_id IS NOT NULL",
              name: "idx_cwua_user_role_hub"

    add_index :cats_warehouse_user_assignments,
              [:user_id, :role_name, :store_id],
              unique: true,
              where: "store_id IS NOT NULL",
              name: "idx_cwua_user_role_store"
  end

  def down
    remove_index :cats_warehouse_user_assignments, name: "idx_cwua_user_role_warehouse"
    remove_index :cats_warehouse_user_assignments, name: "idx_cwua_user_role_hub"
    remove_index :cats_warehouse_user_assignments, name: "idx_cwua_user_role_store"

    add_index :cats_warehouse_user_assignments, [:user_id, :warehouse_id],
              unique: true,
              where: "warehouse_id IS NOT NULL",
              name: "idx_cwua_user_warehouse"

    add_index :cats_warehouse_user_assignments, [:user_id, :hub_id],
              unique: true,
              where: "hub_id IS NOT NULL",
              name: "idx_cwua_user_hub"

    add_index :cats_warehouse_user_assignments, [:user_id, :store_id],
              unique: true,
              where: "store_id IS NOT NULL",
              name: "idx_cwua_user_store"
  end
end
