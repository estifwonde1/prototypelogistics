# This migration comes from cats_warehouse (originally 20260312191140)
class CreateCatsWarehouseWarehouseContacts < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_warehouse_contacts do |t|
      t.references :warehouse,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_warehouses}
      t.string :manager_name
      t.string :contact_phone
      t.string :contact_email

      t.timestamps
    end
  end
end
