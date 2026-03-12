# This migration comes from cats_warehouse (originally 20260312191250)
class CreateCatsWarehouseStockBalances < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_stock_balances do |t|
      t.references :warehouse,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :store,
                   foreign_key: { to_table: :cats_warehouse_stores }
      t.references :stack,
                   foreign_key: { to_table: :cats_warehouse_stacks }
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
