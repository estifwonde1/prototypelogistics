# frozen_string_literal: true

class AddPackageUnitPerPackageToCatsCoreCommodities < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_core_commodities, :package_unit_per_package,
                  foreign_key: { to_table: :cats_core_unit_of_measures },
                  null: true
  end
end
