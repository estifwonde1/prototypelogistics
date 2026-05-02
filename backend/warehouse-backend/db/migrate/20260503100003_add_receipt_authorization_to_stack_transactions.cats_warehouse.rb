class AddReceiptAuthorizationToStackTransactions < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_stack_transactions, :receipt_authorization_id, :bigint, null: true
    add_index :cats_warehouse_stack_transactions, :receipt_authorization_id,
              name: "idx_cw_st_on_ra_id"
    add_foreign_key :cats_warehouse_stack_transactions,
                    :cats_warehouse_receipt_authorizations,
                    column: :receipt_authorization_id
  end
end
