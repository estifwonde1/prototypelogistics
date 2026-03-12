# This migration comes from cats_warehouse (originally 20260312191110)
class CreateCatsWarehouseWarehouseCapacity < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_warehouse_capacity do |t|
      t.references :warehouse,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_warehouses }
      t.float :total_area_sqm
      t.float :total_storage_capacity_mt
      t.float :usable_storage_capacity_mt
      t.integer :no_of_stores
      t.integer :construction_year
      t.string :ownership_type

      t.timestamps
    end
  end
end
