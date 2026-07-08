class AddDestinationToReceiptOrderLines < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_receipt_order_lines, :destination_hub_id, :integer, null: true
    add_column :cats_warehouse_receipt_order_lines, :destination_warehouse_id, :integer, null: true

    add_index :cats_warehouse_receipt_order_lines, :destination_hub_id, name: 'idx_ro_lines_dest_hub_id'
    add_index :cats_warehouse_receipt_order_lines, :destination_warehouse_id, name: 'idx_ro_lines_dest_wh_id'
  end
end
