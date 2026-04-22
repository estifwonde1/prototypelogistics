class AddKebeleToHubs < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_hubs, :kebele, :integer
  end
end
