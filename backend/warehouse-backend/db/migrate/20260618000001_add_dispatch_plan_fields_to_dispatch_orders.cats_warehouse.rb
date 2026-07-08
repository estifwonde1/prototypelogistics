class AddDispatchPlanFieldsToDispatchOrders < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_dispatch_orders, bulk: true do |t|
      t.string :response_plan_ref
      t.date :approval_date
      t.string :response_type
      t.bigint :fdp_id
    end

    add_index :cats_warehouse_dispatch_orders, :fdp_id
  end
end
