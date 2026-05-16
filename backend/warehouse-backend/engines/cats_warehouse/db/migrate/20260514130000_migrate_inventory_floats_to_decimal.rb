# frozen_string_literal: true

# Migrates all inventory-critical float columns in the cats_warehouse engine to
# decimal so that floating-point precision errors cannot corrupt stock figures.
#
# Precision choices:
#   decimal(15, 4)  — quantity / volume columns.
#                     15 digits total, 4 after the decimal point.
#                     Supports up to 99,999,999,999.9999 — more than enough for
#                     any realistic warehouse quantity or cubic-metre volume.
#
# Columns intentionally left as float (not inventory-critical):
#   cats_warehouse_geos.*          — geographic coordinates (float is idiomatic)
#   cats_warehouse_hub_capacity.*  — planning/reporting aggregates
#   cats_warehouse_hub_access.distance_from_town_km — informational
#   cats_warehouse_stacking_rules.*  — configuration dimensions, not transactional
#
# CHECK constraints:
#   The two existing constraints (cw_stacks_quantity_non_negative,
#   cw_stock_balances_quantity_non_negative) were written against double precision.
#   PostgreSQL will automatically apply them to the new numeric type after the
#   column change, but we drop and re-add them with a clean numeric literal so
#   the constraint expression in pg_constraint matches the new column type.
class MigrateInventoryFloatsToDecimal < ActiveRecord::Migration[7.0]
  # Shared precision for all inventory quantity / dimension columns.
  PRECISION = 15
  SCALE     = 4

  def up
    # ── cats_warehouse_stacks ────────────────────────────────────────────────
    # Drop the existing float-typed check constraint first; we'll re-add it
    # after the column type change so the expression matches numeric.
    remove_check_constraint :cats_warehouse_stacks,
                            name: "cw_stacks_quantity_non_negative"

    change_column :cats_warehouse_stacks, :quantity,
                  :decimal, precision: PRECISION, scale: SCALE,
                  null: false, default: 0
    change_column :cats_warehouse_stacks, :length,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stacks, :width,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stacks, :height,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    # start_x / start_y are nullable (unpositioned reservation placeholders).
    change_column :cats_warehouse_stacks, :start_x,
                  :decimal, precision: PRECISION, scale: SCALE, null: true
    change_column :cats_warehouse_stacks, :start_y,
                  :decimal, precision: PRECISION, scale: SCALE, null: true

    add_check_constraint :cats_warehouse_stacks,
                         "quantity >= 0",
                         name: "cw_stacks_quantity_non_negative"

    # ── cats_warehouse_stock_balances ────────────────────────────────────────
    remove_check_constraint :cats_warehouse_stock_balances,
                            name: "cw_stock_balances_quantity_non_negative"

    change_column :cats_warehouse_stock_balances, :quantity,
                  :decimal, precision: PRECISION, scale: SCALE, null: false

    add_check_constraint :cats_warehouse_stock_balances,
                         "quantity >= 0",
                         name: "cw_stock_balances_quantity_non_negative"

    # ── cats_warehouse_grn_items ─────────────────────────────────────────────
    change_column :cats_warehouse_grn_items, :quantity,
                  :decimal, precision: PRECISION, scale: SCALE, null: false

    add_check_constraint :cats_warehouse_grn_items,
                         "quantity > 0",
                         name: "cw_grn_items_quantity_positive"

    # ── cats_warehouse_gin_items ─────────────────────────────────────────────
    change_column :cats_warehouse_gin_items, :quantity,
                  :decimal, precision: PRECISION, scale: SCALE, null: false

    add_check_constraint :cats_warehouse_gin_items,
                         "quantity > 0",
                         name: "cw_gin_items_quantity_positive"

    # ── cats_warehouse_inspection_items ─────────────────────────────────────
    change_column :cats_warehouse_inspection_items, :quantity_received,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_inspection_items, :quantity_damaged,
                  :decimal, precision: PRECISION, scale: SCALE,
                  null: false, default: 0
    change_column :cats_warehouse_inspection_items, :quantity_lost,
                  :decimal, precision: PRECISION, scale: SCALE,
                  null: false, default: 0

    add_check_constraint :cats_warehouse_inspection_items,
                         "quantity_received >= 0",
                         name: "cw_inspection_items_qty_received_non_negative"
    add_check_constraint :cats_warehouse_inspection_items,
                         "quantity_damaged >= 0",
                         name: "cw_inspection_items_qty_damaged_non_negative"
    add_check_constraint :cats_warehouse_inspection_items,
                         "quantity_lost >= 0",
                         name: "cw_inspection_items_qty_lost_non_negative"
    add_check_constraint :cats_warehouse_inspection_items,
                         "quantity_damaged + quantity_lost <= quantity_received",
                         name: "cw_inspection_items_losses_within_received"

    # ── cats_warehouse_inventory_adjustments ─────────────────────────────────
    # quantity is nullable here (adjustment can be positive or negative).
    change_column :cats_warehouse_inventory_adjustments, :quantity,
                  :decimal, precision: PRECISION, scale: SCALE, null: true

    # ── cats_warehouse_stack_transactions ────────────────────────────────────
    # quantity records the absolute movement amount — always positive.
    change_column :cats_warehouse_stack_transactions, :quantity,
                  :decimal, precision: PRECISION, scale: SCALE, null: false

    add_check_constraint :cats_warehouse_stack_transactions,
                         "quantity > 0",
                         name: "cw_stack_transactions_quantity_positive"

    # ── cats_warehouse_stores ────────────────────────────────────────────────
    change_column :cats_warehouse_stores, :length,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stores, :width,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stores, :height,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stores, :usable_space,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stores, :available_space,
                  :decimal, precision: PRECISION, scale: SCALE, null: false
    change_column :cats_warehouse_stores, :gangway_length,
                  :decimal, precision: PRECISION, scale: SCALE, null: true
    change_column :cats_warehouse_stores, :gangway_width,
                  :decimal, precision: PRECISION, scale: SCALE, null: true
    change_column :cats_warehouse_stores, :gangway_corner_dist,
                  :decimal, precision: PRECISION, scale: SCALE, null: true

    add_check_constraint :cats_warehouse_stores,
                         "usable_space >= 0",
                         name: "cw_stores_usable_space_non_negative"
    add_check_constraint :cats_warehouse_stores,
                         "available_space >= 0",
                         name: "cw_stores_available_space_non_negative"
  end

  def down
    # ── cats_warehouse_stores ────────────────────────────────────────────────
    remove_check_constraint :cats_warehouse_stores, name: "cw_stores_available_space_non_negative"
    remove_check_constraint :cats_warehouse_stores, name: "cw_stores_usable_space_non_negative"

    change_column :cats_warehouse_stores, :gangway_corner_dist, :float, null: true
    change_column :cats_warehouse_stores, :gangway_width,       :float, null: true
    change_column :cats_warehouse_stores, :gangway_length,      :float, null: true
    change_column :cats_warehouse_stores, :available_space,     :float, null: false
    change_column :cats_warehouse_stores, :usable_space,        :float, null: false
    change_column :cats_warehouse_stores, :height,              :float, null: false
    change_column :cats_warehouse_stores, :width,               :float, null: false
    change_column :cats_warehouse_stores, :length,              :float, null: false

    # ── cats_warehouse_stack_transactions ────────────────────────────────────
    remove_check_constraint :cats_warehouse_stack_transactions,
                            name: "cw_stack_transactions_quantity_positive"
    change_column :cats_warehouse_stack_transactions, :quantity, :float, null: false

    # ── cats_warehouse_inventory_adjustments ─────────────────────────────────
    change_column :cats_warehouse_inventory_adjustments, :quantity, :float, null: true

    # ── cats_warehouse_inspection_items ─────────────────────────────────────
    remove_check_constraint :cats_warehouse_inspection_items,
                            name: "cw_inspection_items_losses_within_received"
    remove_check_constraint :cats_warehouse_inspection_items,
                            name: "cw_inspection_items_qty_lost_non_negative"
    remove_check_constraint :cats_warehouse_inspection_items,
                            name: "cw_inspection_items_qty_damaged_non_negative"
    remove_check_constraint :cats_warehouse_inspection_items,
                            name: "cw_inspection_items_qty_received_non_negative"

    change_column :cats_warehouse_inspection_items, :quantity_lost,
                  :float, null: false, default: 0.0
    change_column :cats_warehouse_inspection_items, :quantity_damaged,
                  :float, null: false, default: 0.0
    change_column :cats_warehouse_inspection_items, :quantity_received, :float, null: false

    # ── cats_warehouse_gin_items ─────────────────────────────────────────────
    remove_check_constraint :cats_warehouse_gin_items,
                            name: "cw_gin_items_quantity_positive"
    change_column :cats_warehouse_gin_items, :quantity, :float, null: false

    # ── cats_warehouse_grn_items ─────────────────────────────────────────────
    remove_check_constraint :cats_warehouse_grn_items,
                            name: "cw_grn_items_quantity_positive"
    change_column :cats_warehouse_grn_items, :quantity, :float, null: false

    # ── cats_warehouse_stock_balances ────────────────────────────────────────
    remove_check_constraint :cats_warehouse_stock_balances,
                            name: "cw_stock_balances_quantity_non_negative"
    change_column :cats_warehouse_stock_balances, :quantity, :float, null: false
    add_check_constraint :cats_warehouse_stock_balances,
                         "quantity >= 0::double precision",
                         name: "cw_stock_balances_quantity_non_negative"

    # ── cats_warehouse_stacks ────────────────────────────────────────────────
    remove_check_constraint :cats_warehouse_stacks,
                            name: "cw_stacks_quantity_non_negative"

    change_column :cats_warehouse_stacks, :start_y,   :float, null: true
    change_column :cats_warehouse_stacks, :start_x,   :float, null: true
    change_column :cats_warehouse_stacks, :height,    :float, null: false
    change_column :cats_warehouse_stacks, :width,     :float, null: false
    change_column :cats_warehouse_stacks, :length,    :float, null: false
    change_column :cats_warehouse_stacks, :quantity,  :float, null: false, default: 0.0

    add_check_constraint :cats_warehouse_stacks,
                         "quantity >= 0::double precision",
                         name: "cw_stacks_quantity_non_negative"
  end
end
