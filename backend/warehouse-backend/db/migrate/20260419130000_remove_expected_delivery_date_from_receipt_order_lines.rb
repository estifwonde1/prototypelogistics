class RemoveExpectedDeliveryDateFromReceiptOrderLines < ActiveRecord::Migration[7.0]
  def change
    remove_column :cats_warehouse_receipt_order_lines, :expected_delivery_date, :date
  end
end
