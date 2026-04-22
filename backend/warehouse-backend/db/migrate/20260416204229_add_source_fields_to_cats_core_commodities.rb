class AddSourceFieldsToCatsCoreCommodities < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_core_commodities, :source_type, :string
    add_column :cats_core_commodities, :source_name, :string
  end
end
