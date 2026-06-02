class AddWeightPerUnitKgToCommodities < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_core_commodities, :weight_per_unit_kg, :decimal, precision: 15, scale: 6, default: 1.0, null: false
  end
end
