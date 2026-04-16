# frozen_string_literal: true

class AddPackageSizeToCatsCoreCommodities < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_core_commodities, :package_size, :decimal, precision: 15, scale: 4
  end
end
