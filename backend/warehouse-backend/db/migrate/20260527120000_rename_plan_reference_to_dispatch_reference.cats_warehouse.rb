# frozen_string_literal: true

class RenamePlanReferenceToDispatchReference < ActiveRecord::Migration[7.0]
  def change
    if column_exists?(:cats_warehouse_dispatch_orders, :plan_reference)
      remove_index :cats_warehouse_dispatch_orders, column: :plan_reference, if_exists: true
      rename_column :cats_warehouse_dispatch_orders, :plan_reference, :dispatch_reference
    end

    return if index_exists?(:cats_warehouse_dispatch_orders, :dispatch_reference)

    add_index :cats_warehouse_dispatch_orders, :dispatch_reference
  end
end
