class AddAuthorizedQuantityInputToDispatchOrderAuthorizations < ActiveRecord::Migration[7.0]
  def change
    # Add the as-typed quantity column (mirrors receipt_authorizations pattern)
    unless column_exists?(:cats_warehouse_dispatch_order_authorizations, :authorized_quantity_input)
      add_column :cats_warehouse_dispatch_order_authorizations, :authorized_quantity_input,
                 :decimal, precision: 15, scale: 6
    end
  end
end
