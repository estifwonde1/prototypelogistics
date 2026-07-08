# frozen_string_literal: true

class AddReceiptOrderLineToReceiptAuthorizations < ActiveRecord::Migration[7.0]
  def change
    add_reference :cats_warehouse_receipt_authorizations, :receipt_order_line,
                  foreign_key: { to_table: :cats_warehouse_receipt_order_lines },
                  index: { name: "idx_cw_ra_receipt_order_line" }
  end
end
