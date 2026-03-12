# This migration comes from cats_warehouse (originally 20260312191280)
class CreateCatsWarehouseGins < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_gins do |t|
      t.string :reference_no
      t.references :warehouse,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_warehouses}
      t.date :issued_on, null: false
      t.references :destination, polymorphic: true
      t.string :status, null: false, default: "Draft"
      t.references :issued_by,
                   null: false,
                   foreign_key: {to_table: :cats_core_users}
      t.references :approved_by,
                   foreign_key: {to_table: :cats_core_users}

      t.timestamps
    end
  end
end
