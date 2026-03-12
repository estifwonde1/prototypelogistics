class CreateCatsWarehouseHubInfra < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_hub_infra do |t|
      t.references :hub,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_hubs}
      t.string :floor_type
      t.string :roof_type
      t.boolean :has_ventilation
      t.boolean :has_drainage_system
      t.boolean :has_fumigation_facility
      t.boolean :has_pest_control
      t.boolean :has_fire_extinguisher
      t.boolean :has_security_guard
      t.string :security_type

      t.timestamps
    end
  end
end
