# frozen_string_literal: true

class AddAssignedStorekeeperToReceiptAuthorizations < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_receipt_authorizations, bulk: true do |t|
      t.bigint :assigned_storekeeper_id
      t.bigint :assigned_storekeeper_by_id
      t.datetime :assigned_storekeeper_at

      t.index :assigned_storekeeper_id, name: "idx_cw_ra_on_assigned_storekeeper_id"
    end

    add_foreign_key :cats_warehouse_receipt_authorizations, :cats_core_users,
                    column: :assigned_storekeeper_id
    add_foreign_key :cats_warehouse_receipt_authorizations, :cats_core_users,
                    column: :assigned_storekeeper_by_id
  end
end
