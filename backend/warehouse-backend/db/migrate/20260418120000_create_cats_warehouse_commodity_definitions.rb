class CreateCatsWarehouseCommodityDefinitions < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_commodity_definitions do |t|
      t.string :name, null: false
      t.bigint :commodity_category_id
      t.timestamps
    end

    add_index :cats_warehouse_commodity_definitions, :name, unique: true
    add_index :cats_warehouse_commodity_definitions, :commodity_category_id, name: 'idx_comm_defs_on_category_id'
  end
end
