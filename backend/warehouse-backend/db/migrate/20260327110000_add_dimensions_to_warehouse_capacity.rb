class AddDimensionsToWarehouseCapacity < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_warehouse_capacity, bulk: true do |t|
      t.float :length_m
      t.float :width_m
      t.float :height_m
    end
  end
end
