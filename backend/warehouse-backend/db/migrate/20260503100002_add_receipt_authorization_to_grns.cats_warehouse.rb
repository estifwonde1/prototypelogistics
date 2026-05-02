class AddReceiptAuthorizationToGrns < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_warehouse_grns, :receipt_authorization,
      null: true,
      foreign_key: { to_table: :cats_warehouse_receipt_authorizations }
  end
end
