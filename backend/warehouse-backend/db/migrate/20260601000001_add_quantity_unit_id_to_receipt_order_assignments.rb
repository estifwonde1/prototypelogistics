class AddQuantityUnitIdToReceiptOrderAssignments < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_receipt_order_assignments, :quantity_unit_id, :bigint
    add_foreign_key :cats_warehouse_receipt_order_assignments, :cats_core_unit_of_measures, column: :quantity_unit_id
    add_index :cats_warehouse_receipt_order_assignments, :quantity_unit_id, name: "idx_cw_ro_assign_qty_unit"
  end
end
