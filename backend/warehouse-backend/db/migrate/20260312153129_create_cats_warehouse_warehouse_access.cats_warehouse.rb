# This migration comes from cats_warehouse (originally 20260312191120)
class CreateCatsWarehouseWarehouseAccess < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_warehouse_access do |t|
      t.references :warehouse,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_warehouses}
      t.boolean :has_loading_dock
      t.integer :number_of_loading_docks
      t.string :access_road_type
      t.string :nearest_town
      t.float :distance_from_town_km

      t.timestamps
    end
  end
end
