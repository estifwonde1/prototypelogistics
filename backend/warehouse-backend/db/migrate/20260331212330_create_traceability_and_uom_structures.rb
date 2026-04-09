# This migration comes from cats_warehouse (originally 20260401090000)
class CreateTraceabilityAndUomStructures < ActiveRecord::Migration[7.0]
  def change
    # 1. New Tables
    unless table_exists?(:cats_warehouse_inventory_lots)
      create_table :cats_warehouse_inventory_lots do |t|
        t.references :warehouse, null: false, foreign_key: { to_table: :cats_warehouse_warehouses }
        t.references :commodity, null: false, foreign_key: { to_table: :cats_core_commodities }
        t.string :source_type
        t.bigint :source_id
        t.string :lot_code
        t.string :batch_no, null: false
        t.date :expiry_date
        t.date :manufactured_on
        t.date :received_on
        t.string :status, null: false, default: "Active"
        t.string :description
        t.timestamps
      end
    end
    add_index :cats_warehouse_inventory_lots, [:warehouse_id, :commodity_id, :batch_no, :expiry_date], unique: true, name: 'idx_lot_warehouse_commodity_batch_expiry' unless index_exists?(:cats_warehouse_inventory_lots, [:warehouse_id, :commodity_id, :batch_no, :expiry_date], name: 'idx_lot_warehouse_commodity_batch_expiry')
    unless index_exists?(:cats_warehouse_inventory_lots, [:source_type, :source_id], name: "idx_cw_inventory_lots_source")
      add_index :cats_warehouse_inventory_lots,
                [:source_type, :source_id],
                name: "idx_cw_inventory_lots_source"
    end

    unless table_exists?(:cats_warehouse_uom_conversions)
      create_table :cats_warehouse_uom_conversions do |t|
        t.references :commodity, foreign_key: { to_table: :cats_core_commodities } # Nullable if global
        t.references :from_unit, null: false, foreign_key: { to_table: :cats_core_unit_of_measures }
        t.references :to_unit, null: false, foreign_key: { to_table: :cats_core_unit_of_measures }
        t.decimal :multiplier, null: false, precision: 15, scale: 6
        t.string :conversion_type
        t.boolean :active, null: false, default: true
        t.boolean :is_inter_unit, default: false
        t.timestamps
      end
    end

    # 2. Add columns to inventory tables
    tables_to_update = [
      :cats_warehouse_stock_balances,
      :cats_warehouse_stack_transactions,
      :cats_warehouse_grn_items,
      :cats_warehouse_gin_items,
      :cats_warehouse_waybill_items,
      :cats_warehouse_inspection_items
    ]

    tables_to_update.each do |table_name|
      change_table table_name do |t|
        t.references :inventory_lot, foreign_key: { to_table: :cats_warehouse_inventory_lots } unless column_exists?(table_name, :inventory_lot_id)
        t.references :entered_unit, foreign_key: { to_table: :cats_core_unit_of_measures } unless column_exists?(table_name, :entered_unit_id)
        t.references :base_unit, foreign_key: { to_table: :cats_core_unit_of_measures } unless column_exists?(table_name, :base_unit_id)
        t.decimal :base_quantity, precision: 15, scale: 3 unless column_exists?(table_name, :base_quantity)
      end
    end

    # 3. Specific update for Stacks
    change_table :cats_warehouse_stacks do |t|
      t.references :base_unit, foreign_key: { to_table: :cats_core_unit_of_measures } unless column_exists?(:cats_warehouse_stacks, :base_unit_id)
      t.decimal :base_quantity, precision: 15, scale: 3 unless column_exists?(:cats_warehouse_stacks, :base_quantity)
    end

    # 4. Data backfill instruction (to be handled in a reversible block or post-migration)
    # For simplicity in this dev environment, we'll try a basic update if columns are added
  end
end
