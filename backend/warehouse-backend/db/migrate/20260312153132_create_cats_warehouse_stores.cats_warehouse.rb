# This migration comes from cats_warehouse (originally 20260312191200)
class CreateCatsWarehouseStores < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_stores do |t|
      t.string :code
      t.string :name, null: false
      t.float :length, null: false
      t.float :width, null: false
      t.float :height, null: false
      t.float :usable_space, null: false
      t.float :available_space, null: false
      t.boolean :temporary, default: false, null: false
      t.boolean :has_gangway, default: false, null: false
      t.float :gangway_length
      t.float :gangway_width
      t.float :gangway_corner_dist
      t.references :warehouse,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_warehouses}

      t.timestamps
    end
  end
end
