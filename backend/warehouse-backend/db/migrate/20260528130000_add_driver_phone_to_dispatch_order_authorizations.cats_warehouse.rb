# frozen_string_literal: true

class AddDriverPhoneToDispatchOrderAuthorizations < ActiveRecord::Migration[7.0]
  def change
    return if column_exists?(:cats_warehouse_dispatch_order_authorizations, :driver_phone)

    add_column :cats_warehouse_dispatch_order_authorizations, :driver_phone, :string
  end
end
