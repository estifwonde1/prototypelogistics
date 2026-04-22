class RemoveUnitPriceFromReceiptOrderLines < ActiveRecord::Migration[7.0]
  def change
    remove_column :cats_warehouse_receipt_order_lines, :unit_price, :decimal
  end
end
