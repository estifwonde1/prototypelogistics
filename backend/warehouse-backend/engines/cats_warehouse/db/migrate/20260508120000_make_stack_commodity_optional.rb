class MakeStackCommodityOptional < ActiveRecord::Migration[7.0]
  def change
    # Make commodity_id and unit_id nullable so stacks can exist without a commodity
    # (a stack is a physical space; commodity is assigned when goods are placed in it)
    change_column_null :cats_warehouse_stacks, :commodity_id, true
    change_column_null :cats_warehouse_stacks, :unit_id, true
  end
end
