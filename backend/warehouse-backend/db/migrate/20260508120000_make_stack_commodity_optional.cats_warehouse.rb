# This migration is part of the cats_warehouse engine.
# It makes commodity_id and unit_id nullable on stacks so that
# stacks can exist as empty physical spaces with no commodity affiliation.
class MakeStackCommodityOptional < ActiveRecord::Migration[7.0]
  def change
    change_column_null :cats_warehouse_stacks, :commodity_id, true
    change_column_null :cats_warehouse_stacks, :unit_id, true
  end
end
