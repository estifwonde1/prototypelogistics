class CreateCatsWarehouseGinItems < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_gin_items do |t|
      t.references :gin,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_gins }
      t.references :commodity,
                   null: false,
                   foreign_key: { to_table: :cats_core_commodities }
      t.float :quantity, null: false
      t.references :unit,
                   null: false,
                   foreign_key: { to_table: :cats_core_unit_of_measures }
      t.references :store,
                   foreign_key: { to_table: :cats_warehouse_stores }
      t.references :stack,
                   foreign_key: { to_table: :cats_warehouse_stacks }

      t.timestamps
    end
  end
end
