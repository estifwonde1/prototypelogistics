class MakeStackCommodityOptional < ActiveRecord::Migration[7.0]
  def change
    change_column_null :cats_warehouse_stacks, :commodity_id, true
    change_column_null :cats_warehouse_stacks, :unit_id, true
  end
end
