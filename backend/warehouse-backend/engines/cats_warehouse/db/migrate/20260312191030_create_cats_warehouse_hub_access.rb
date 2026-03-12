class CreateCatsWarehouseHubAccess < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_hub_access do |t|
      t.references :hub,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_hubs}
      t.boolean :has_loading_dock
      t.integer :number_of_loading_docks
      t.string :loading_dock_type
      t.string :access_road_type
      t.string :nearest_town
      t.float :distance_from_town_km
      t.boolean :has_weighbridge

      t.timestamps
    end
  end
end
