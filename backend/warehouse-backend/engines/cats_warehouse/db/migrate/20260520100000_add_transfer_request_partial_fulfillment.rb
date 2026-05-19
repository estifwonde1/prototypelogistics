# frozen_string_literal: true

class AddTransferRequestPartialFulfillment < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_transfer_requests, bulk: true do |t|
      unless column_exists?(:cats_warehouse_transfer_requests, :fulfilled_quantity)
        t.decimal :fulfilled_quantity, precision: 15, scale: 3, null: false, default: 0
      end
      unless column_exists?(:cats_warehouse_transfer_requests, :rejected_quantity)
        t.decimal :rejected_quantity, precision: 15, scale: 3, null: false, default: 0
      end
    end

    reversible do |dir|
      dir.up do
        execute <<-SQL.squish
          UPDATE cats_warehouse_transfer_requests
          SET fulfilled_quantity = quantity
          WHERE status = 'Completed'
        SQL
        execute <<-SQL.squish
          UPDATE cats_warehouse_transfer_requests
          SET rejected_quantity = quantity
          WHERE status = 'Rejected'
        SQL
      end
    end

    create_table :cats_warehouse_transfer_request_allocations do |t|
      t.references :transfer_request,
                   null: false,
                   foreign_key: { to_table: :cats_warehouse_transfer_requests },
                   index: { name: "index_cw_tr_allocations_on_transfer_request_id" }
      t.string :action, null: false
      t.decimal :quantity, precision: 15, scale: 3, null: false
      t.references :entered_unit,
                   foreign_key: { to_table: :cats_core_unit_of_measures },
                   index: { name: "index_cw_tr_allocations_on_entered_unit_id" }
      t.decimal :entered_quantity, precision: 15, scale: 3
      t.decimal :package_count, precision: 15, scale: 4
      t.references :destination_stack,
                   foreign_key: { to_table: :cats_warehouse_stacks },
                   index: { name: "index_cw_tr_allocations_on_destination_stack_id" }
      t.references :stack_transaction,
                   foreign_key: { to_table: :cats_warehouse_stack_transactions },
                   index: { name: "index_cw_tr_allocations_on_stack_transaction_id" }
      t.references :reviewed_by,
                   null: false,
                   foreign_key: { to_table: :cats_core_users },
                   index: { name: "index_cw_tr_allocations_on_reviewed_by_id" }
      t.text :notes
      t.timestamps
    end

    add_index :cats_warehouse_transfer_request_allocations,
              :action,
              name: "index_cw_tr_allocations_on_action"
  end
end
