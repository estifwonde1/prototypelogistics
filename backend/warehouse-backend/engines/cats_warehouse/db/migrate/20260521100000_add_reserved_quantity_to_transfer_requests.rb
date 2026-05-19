# frozen_string_literal: true

class AddReservedQuantityToTransferRequests < ActiveRecord::Migration[7.0]
  def change
    unless column_exists?(:cats_warehouse_transfer_requests, :reserved_quantity)
      add_column :cats_warehouse_transfer_requests, :reserved_quantity,
                 :decimal, precision: 15, scale: 3, null: false, default: 0
    end
  end
end
