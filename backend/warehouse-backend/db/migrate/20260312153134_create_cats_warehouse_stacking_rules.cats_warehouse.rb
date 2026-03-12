# This migration comes from cats_warehouse (originally 20260312191220)
class CreateCatsWarehouseStackingRules < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_stacking_rules do |t|
      t.references :warehouse,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_warehouses }
      t.float :distance_from_wall, null: false
      t.float :space_between_stack, null: false
      t.float :distance_from_ceiling, null: false
      t.float :maximum_height, null: false
      t.float :maximum_length, null: false
      t.float :maximum_width, null: false
      t.float :distance_from_gangway, null: false

      t.timestamps
    end
  end
end
