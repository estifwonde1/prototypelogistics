class AddUsableSpacePercentageToWarehouseCapacity < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_warehouse_capacity, :usable_space_percentage, :integer, default: 75, null: false
  end
end
