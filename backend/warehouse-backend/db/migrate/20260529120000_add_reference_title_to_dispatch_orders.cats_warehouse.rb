# frozen_string_literal: true

class AddReferenceTitleToDispatchOrders < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_dispatch_orders, :reference_title, :string
  end
end
