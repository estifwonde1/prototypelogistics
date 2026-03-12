# This migration comes from cats_warehouse (originally 20260312191240)
class CreateCatsWarehouseStackTransactions < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_stack_transactions do |t|
      t.references :source,
                   null: false,
                   index: { name: "source_on_cwst_indx" },
                   foreign_key: { to_table: :cats_warehouse_stacks }
      t.references :destination,
                   null: false,
                   index: { name: "destination_on_cwst_indx" },
                   foreign_key: { to_table: :cats_warehouse_stacks }
      t.date :transaction_date, null: false
      t.float :quantity, null: false
      t.references :unit,
                   null: false,
                   index: { name: "unit_on_cwst_indx" },
                   foreign_key: { to_table: :cats_core_unit_of_measures }
      t.string :status, null: false, default: "Draft"

      t.timestamps
    end
  end
end
