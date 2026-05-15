# frozen_string_literal: true

# Adds the columns needed for live space tracking:
#
#   cats_warehouse_stacks.occupied_volume  — volume (l*w*h) of this stack when it holds goods.
#                                            NULL means the value has not been computed yet
#                                            (backfilled by the migration for existing rows).
#
#   cats_warehouse_stores.occupied_space   — sum of occupied_volume across all non-empty stacks
#                                            in this store.  Kept in sync by StoreOccupancyUpdater.
#
# Both columns are decimal so we don't lose precision when summing many stacks.
class AddSpaceTrackingColumns < ActiveRecord::Migration[7.0]
  def up
    add_column :cats_warehouse_stacks, :occupied_volume, :decimal,
               precision: 15, scale: 4, null: true

    add_column :cats_warehouse_stores, :occupied_space, :decimal,
               precision: 15, scale: 4, null: false, default: 0

    # Backfill occupied_volume for existing stacks.
    # A stack is "occupied" when its quantity > 0 (i.e. stack_status != 'empty').
    execute <<~SQL
      UPDATE cats_warehouse_stacks
      SET    occupied_volume = CASE
               WHEN quantity > 0 THEN length * width * height
               ELSE 0
             END
    SQL

    # Backfill occupied_space for existing stores.
    execute <<~SQL
      UPDATE cats_warehouse_stores s
      SET    occupied_space = COALESCE((
               SELECT SUM(st.occupied_volume)
               FROM   cats_warehouse_stacks st
               WHERE  st.store_id = s.id
                 AND  st.occupied_volume IS NOT NULL
             ), 0)
    SQL

    # Now that every row has a value, tighten the NOT NULL constraint on stacks.
    change_column_null :cats_warehouse_stacks, :occupied_volume, false, 0
  end

  def down
    remove_column :cats_warehouse_stores, :occupied_space
    remove_column :cats_warehouse_stacks, :occupied_volume
  end
end
