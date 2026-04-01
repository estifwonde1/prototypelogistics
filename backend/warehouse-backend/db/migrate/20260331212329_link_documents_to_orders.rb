# This migration comes from cats_warehouse (originally 20260331230010)
class LinkDocumentsToOrders < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_warehouse_inspections, :receipt_order, foreign_key: { to_table: :cats_warehouse_receipt_orders }, index: true, null: true unless column_exists?(:cats_warehouse_inspections, :receipt_order_id)
    add_reference :cats_warehouse_grns, :receipt_order, foreign_key: { to_table: :cats_warehouse_receipt_orders }, index: true, null: true unless column_exists?(:cats_warehouse_grns, :receipt_order_id)
    add_reference :cats_warehouse_waybills, :dispatch_order, foreign_key: { to_table: :cats_warehouse_dispatch_orders }, index: true, null: true unless column_exists?(:cats_warehouse_waybills, :dispatch_order_id)
    add_reference :cats_warehouse_gins, :dispatch_order, foreign_key: { to_table: :cats_warehouse_dispatch_orders }, index: true, null: true unless column_exists?(:cats_warehouse_gins, :dispatch_order_id)
  end
end
