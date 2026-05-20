# frozen_string_literal: true

class AddTransferUomAndPackageFields < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_stack_transactions, bulk: true do |t|
      t.decimal :entered_quantity, precision: 15, scale: 3 unless column_exists?(:cats_warehouse_stack_transactions, :entered_quantity)
      t.decimal :package_count, precision: 15, scale: 4 unless column_exists?(:cats_warehouse_stack_transactions, :package_count)
    end

    change_table :cats_warehouse_transfer_requests, bulk: true do |t|
      unless column_exists?(:cats_warehouse_transfer_requests, :entered_unit_id)
        t.references :entered_unit,
                     foreign_key: { to_table: :cats_core_unit_of_measures },
                     index: { name: "index_cw_transfer_requests_on_entered_unit_id" }
      end
      t.decimal :entered_quantity, precision: 15, scale: 3 unless column_exists?(:cats_warehouse_transfer_requests, :entered_quantity)
      t.decimal :package_count, precision: 15, scale: 4 unless column_exists?(:cats_warehouse_transfer_requests, :package_count)
    end
  end
end
