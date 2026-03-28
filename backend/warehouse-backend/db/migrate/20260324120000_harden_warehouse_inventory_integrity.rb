class HardenWarehouseInventoryIntegrity < ActiveRecord::Migration[7.0]
  UNIQUE_BALANCE_INDEX = "idx_cats_warehouse_stock_balances_unique_dimension".freeze

  def up
    change_column_null :cats_warehouse_stack_transactions, :source_id, true
    change_column_null :cats_warehouse_stack_transactions, :destination_id, true

    add_column :cats_warehouse_stack_transactions, :reference_type, :string
    add_column :cats_warehouse_stack_transactions, :reference_id, :bigint

    add_check_constraint :cats_warehouse_stock_balances, "quantity >= 0", name: "cw_stock_balances_quantity_non_negative"
    add_check_constraint :cats_warehouse_stacks, "quantity >= 0", name: "cw_stacks_quantity_non_negative"

    execute <<~SQL
      CREATE UNIQUE INDEX #{UNIQUE_BALANCE_INDEX}
      ON cats_warehouse_stock_balances (
        warehouse_id,
        COALESCE(store_id, -1),
        COALESCE(stack_id, -1),
        commodity_id,
        unit_id
      )
    SQL
  end

  def down
    execute "DROP INDEX IF EXISTS #{UNIQUE_BALANCE_INDEX}"

    remove_check_constraint :cats_warehouse_stock_balances, name: "cw_stock_balances_quantity_non_negative"
    remove_check_constraint :cats_warehouse_stacks, name: "cw_stacks_quantity_non_negative"

    remove_column :cats_warehouse_stack_transactions, :reference_id
    remove_column :cats_warehouse_stack_transactions, :reference_type

    change_column_null :cats_warehouse_stack_transactions, :destination_id, false
    change_column_null :cats_warehouse_stack_transactions, :source_id, false
  end
end
