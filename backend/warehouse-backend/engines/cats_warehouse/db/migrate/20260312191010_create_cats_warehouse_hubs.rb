class CreateCatsWarehouseHubs < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_hubs do |t|
      t.references :location,
                   null: false,
                   foreign_key: { to_table: :cats_core_locations }
      t.references :geo,
                   foreign_key: { to_table: :cats_warehouse_geos }
      t.string :code
      t.string :name, null: false
      t.string :hub_type
      t.string :status
      t.text :description

      t.timestamps
    end

    add_index :cats_warehouse_hubs, :geo_id, unique: true, if_not_exists: true
  end
end
