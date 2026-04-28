# This migration comes from cats_warehouse (originally 20260410120000)
class AddPackagingToReceiptOrderLines < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_warehouse_receipt_order_lines, :packaging_unit,
                  foreign_key: { to_table: :cats_core_unit_of_measures },
                  null: true

    add_column :cats_warehouse_receipt_order_lines, :packaging_size, :decimal,
               precision: 15, scale: 4, null: true
  end
end
