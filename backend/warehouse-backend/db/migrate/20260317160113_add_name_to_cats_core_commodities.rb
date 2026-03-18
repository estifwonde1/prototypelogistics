class AddNameToCatsCoreCommodities < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_core_commodities, :name, :string
  end
end
