# frozen_string_literal: true

class CreateCatsWarehouseTransferRequests < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_transfer_requests do |t|
      t.references :source_store, null: false, foreign_key: { to_table: :cats_warehouse_stores }
      t.references :destination_store, null: false, foreign_key: { to_table: :cats_warehouse_stores }
      t.references :source_stack, null: false, foreign_key: { to_table: :cats_warehouse_stacks }
      t.references :commodity, null: false, foreign_key: { to_table: :cats_core_commodities }
      t.references :unit, null: false, foreign_key: { to_table: :cats_core_unit_of_measures }
      t.decimal :quantity, precision: 15, scale: 3, null: false
      t.string :reason
      t.string :status, null: false, default: "Pending"
      t.references :requested_by, null: false, foreign_key: { to_table: :cats_core_users }
      t.references :reviewed_by, foreign_key: { to_table: :cats_core_users }
      t.datetime :reviewed_at
      t.text :review_notes
      t.references :warehouse, null: false, foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :destination_stack, foreign_key: { to_table: :cats_warehouse_stacks }

      t.timestamps
    end

    add_index :cats_warehouse_transfer_requests, :status
  end
end
