class CreateCatsWarehouseHubContacts < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_hub_contacts do |t|
      t.references :hub,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_hubs }
      t.string :manager_name
      t.string :contact_phone
      t.string :contact_email

      t.timestamps
    end
  end
end
