# This migration comes from cats_warehouse (originally 20260312191210)
class CreateCatsWarehouseStacks < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_stacks do |t|
      t.string :code
      t.float :length, null: false
      t.float :width, null: false
      t.float :height, null: false
      t.float :start_x
      t.float :start_y
      t.references :commodity,
                   null: false,
                   foreign_key: { to_table: :cats_core_commodities }
      t.references :store,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_stores }
      t.string :commodity_status, default: "Good", null: false
      t.string :stack_status, default: "Reserved", null: false
      t.float :quantity, default: 0, null: false
      t.references :unit,
                   null: false,
                   foreign_key: { to_table: :cats_core_unit_of_measures }

      t.timestamps
    end
  end
end
