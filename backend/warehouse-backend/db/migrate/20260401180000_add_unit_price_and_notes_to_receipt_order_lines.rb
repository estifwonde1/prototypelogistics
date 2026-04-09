class AddUnitPriceAndNotesToReceiptOrderLines < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_receipt_order_lines, :unit_price, :decimal, precision: 15, scale: 4
    add_column :cats_warehouse_receipt_order_lines, :notes, :text
  end
end
