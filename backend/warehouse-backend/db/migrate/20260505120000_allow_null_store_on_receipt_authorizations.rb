class AllowNullStoreOnReceiptAuthorizations < ActiveRecord::Migration[7.0]
  def change
    change_column_null :cats_warehouse_receipt_authorizations, :store_id, true
  end
end
