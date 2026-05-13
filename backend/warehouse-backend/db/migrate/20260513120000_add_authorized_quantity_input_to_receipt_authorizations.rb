# frozen_string_literal: true

# Preserves the unit the user actually typed when creating a Receipt Authorization
# (e.g. 30 Kuntal) so downstream users see that same unit instead of always seeing
# the receipt-order line's canonical unit (MT). `authorized_quantity` remains in the
# line unit for allocation/ceiling math; the columns added here are display-side
# information only.
class AddAuthorizedQuantityInputToReceiptAuthorizations < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_receipt_authorizations,
               :authorized_quantity_input,
               :decimal,
               precision: 15,
               scale: 6,
               null: true

    add_reference :cats_warehouse_receipt_authorizations,
                  :authorized_quantity_input_unit,
                  foreign_key: { to_table: :cats_core_unit_of_measures },
                  null: true,
                  index: { name: "idx_cw_ra_auth_qty_input_unit" }
  end
end
