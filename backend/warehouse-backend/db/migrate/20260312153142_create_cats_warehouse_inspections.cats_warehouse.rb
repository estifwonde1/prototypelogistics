# This migration comes from cats_warehouse (originally 20260312191300)
class CreateCatsWarehouseInspections < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_inspections do |t|
      t.string :reference_no
      t.references :warehouse,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_warehouses }
      t.date :inspected_on, null: false
      t.references :inspector,
                   null: false,
                   foreign_key: { to_table: :cats_core_users }
      t.references :source, polymorphic: true
      t.string :status, null: false, default: "Draft"

      t.timestamps
    end
  end
end
