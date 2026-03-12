# This migration comes from cats_warehouse (originally 20260312191100)
class CreateCatsWarehouseWarehouses < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_warehouses do |t|
      t.references :location,
                   null: false,
                   foreign_key: {to_table: :cats_core_locations}
      t.references :hub,
                   foreign_key: {to_table: :cats_warehouse_hubs}
      t.references :geo,
                   foreign_key: {to_table: :cats_warehouse_geos}
      t.string :code
      t.string :name, null: false
      t.string :warehouse_type
      t.string :status
      t.text :description

      t.timestamps
    end

    add_index :cats_warehouse_warehouses, :geo_id, unique: true, if_not_exists: true
  end
end
