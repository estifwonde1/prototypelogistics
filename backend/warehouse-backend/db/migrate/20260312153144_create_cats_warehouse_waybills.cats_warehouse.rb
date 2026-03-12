# This migration comes from cats_warehouse (originally 20260312191320)
class CreateCatsWarehouseWaybills < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_waybills do |t|
      t.string :reference_no
      t.references :dispatch,
                   foreign_key: {to_table: :cats_core_dispatches}
      t.references :source_location,
                   null: false,
                   foreign_key: {to_table: :cats_core_locations}
      t.references :destination_location,
                   null: false,
                   foreign_key: {to_table: :cats_core_locations}
      t.date :issued_on, null: false
      t.string :status

      t.timestamps
    end
  end
end
