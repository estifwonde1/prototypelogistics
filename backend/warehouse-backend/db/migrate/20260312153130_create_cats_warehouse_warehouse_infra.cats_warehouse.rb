# This migration comes from cats_warehouse (originally 20260312191130)
class CreateCatsWarehouseWarehouseInfra < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_warehouse_infra do |t|
      t.references :warehouse,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_warehouses }
      t.string :floor_type
      t.string :roof_type
      t.boolean :has_fumigation_facility
      t.boolean :has_fire_extinguisher
      t.boolean :has_security_guard

      t.timestamps
    end
  end
end
