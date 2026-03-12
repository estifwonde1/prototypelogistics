class CreateCatsWarehouseHubCapacity < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_hub_capacity do |t|
      t.references :hub,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_hubs}
      t.float :total_area_sqm
      t.float :total_capacity_mt
      t.integer :construction_year
      t.string :ownership_type

      t.timestamps
    end
  end
end
