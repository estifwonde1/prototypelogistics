class CreateCatsWarehouseFdps < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_fdps do |t|
      t.string :name, null: false
      t.bigint :location_id
      t.string :location_name
      t.integer :number_of_families
      t.integer :number_of_beneficiaries
      t.timestamps
    end

    add_index :cats_warehouse_fdps, :name
    add_index :cats_warehouse_fdps, :location_id
  end
end
