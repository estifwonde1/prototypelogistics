class AddKebeleToWarehouses < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_warehouses, :kebele, :integer
  end
end
