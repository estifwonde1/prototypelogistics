# This migration comes from cats_warehouse (originally 20260312191310)
class CreateCatsWarehouseInspectionItems < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_inspection_items do |t|
      t.references :inspection,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_inspections }
      t.references :commodity,
                   null: false,
                   foreign_key: { to_table: :cats_core_commodities }
      t.float :quantity_received, null: false
      t.float :quantity_damaged, null: false, default: 0
      t.float :quantity_lost, null: false, default: 0
      t.string :quality_status
      t.string :packaging_condition
      t.text :remarks

      t.timestamps
    end
  end
end
