class CreateCatsWarehouseInventoryAdjustments < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_inventory_adjustments do |t|
      t.string :reference_no
      t.float :quantity
      t.string :reason_for_adjustment
      t.date :adjustment_date, null: false
      t.string :status, default: "Draft", null: false
      t.references :unit,
                   null: false,
                   foreign_key: { to_table: :cats_core_unit_of_measures }
      t.references :stack,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_stacks }

      t.timestamps
    end
  end
end
