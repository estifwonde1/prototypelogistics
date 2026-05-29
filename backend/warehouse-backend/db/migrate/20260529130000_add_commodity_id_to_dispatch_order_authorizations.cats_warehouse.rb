# frozen_string_literal: true

class AddCommodityIdToDispatchOrderAuthorizations < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_dispatch_order_authorizations, :commodity_id, :bigint
    add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_commodities, column: :commodity_id
    add_index :cats_warehouse_dispatch_order_authorizations, :commodity_id, name: "idx_cw_doa_commodity"

    change_column_null :cats_warehouse_dispatch_order_authorizations, :transporter_id, true
  end
end
