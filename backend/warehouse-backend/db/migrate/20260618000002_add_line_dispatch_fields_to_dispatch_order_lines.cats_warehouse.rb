class AddLineDispatchFieldsToDispatchOrderLines < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_dispatch_order_lines, bulk: true do |t|
      t.bigint :warehouse_id
      t.bigint :hub_id
      t.bigint :fdp_id
      t.datetime :expected_receive_at
    end

    add_index :cats_warehouse_dispatch_order_lines, :warehouse_id
    add_index :cats_warehouse_dispatch_order_lines, :hub_id
    add_index :cats_warehouse_dispatch_order_lines, :fdp_id
  end
end
