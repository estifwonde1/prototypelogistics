# This migration comes from cats_warehouse (originally 20260312191340)
class CreateCatsWarehouseWaybillItems < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_waybill_items do |t|
      t.references :waybill,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_waybills }
      t.references :commodity,
                   null: false,
                   foreign_key: { to_table: :cats_core_commodities }
      t.float :quantity, null: false
      t.references :unit,
                   null: false,
                   foreign_key: { to_table: :cats_core_unit_of_measures }

      t.timestamps
    end
  end
end
