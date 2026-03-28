class AddCommodityCatagoryToCatsCoreCommodities < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_core_commodities,
                  :commodity_category,
                  foreign_key: { to_table: :cats_core_commodity_categories },
                  null: true
  end
end