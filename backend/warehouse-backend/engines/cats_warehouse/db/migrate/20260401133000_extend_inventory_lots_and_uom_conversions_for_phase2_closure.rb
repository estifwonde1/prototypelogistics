class ExtendInventoryLotsAndUomConversionsForPhase2Closure < ActiveRecord::Migration[7.1]
  def change
    change_table :cats_warehouse_inventory_lots do |t|
      t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses } unless column_exists?(:cats_warehouse_inventory_lots, :warehouse_id)
      t.string :source_type unless column_exists?(:cats_warehouse_inventory_lots, :source_type)
      t.bigint :source_id unless column_exists?(:cats_warehouse_inventory_lots, :source_id)
      t.string :lot_code unless column_exists?(:cats_warehouse_inventory_lots, :lot_code)
      t.date :manufactured_on unless column_exists?(:cats_warehouse_inventory_lots, :manufactured_on)
      t.date :received_on unless column_exists?(:cats_warehouse_inventory_lots, :received_on)
      t.string :status, default: "Active" unless column_exists?(:cats_warehouse_inventory_lots, :status)
    end

    change_column_null :cats_warehouse_inventory_lots, :warehouse_id, true

    add_index :cats_warehouse_inventory_lots, [:source_type, :source_id], name: "index_cats_warehouse_inventory_lots_on_source", unless: index_exists?(:cats_warehouse_inventory_lots, [:source_type, :source_id], name: "index_cats_warehouse_inventory_lots_on_source")

    if index_exists?(:cats_warehouse_inventory_lots, [:commodity_id, :batch_no], name: "idx_lot_commodity_batch")
      remove_index :cats_warehouse_inventory_lots, name: "idx_lot_commodity_batch"
    end

    add_index :cats_warehouse_inventory_lots,
              [:warehouse_id, :commodity_id, :batch_no, :expiry_date],
              unique: true,
              name: "idx_lot_warehouse_commodity_batch_expiry",
              unless: index_exists?(:cats_warehouse_inventory_lots, [:warehouse_id, :commodity_id, :batch_no, :expiry_date], name: "idx_lot_warehouse_commodity_batch_expiry")

    change_table :cats_warehouse_uom_conversions do |t|
      t.string :conversion_type unless column_exists?(:cats_warehouse_uom_conversions, :conversion_type)
      t.boolean :active, default: true, null: false unless column_exists?(:cats_warehouse_uom_conversions, :active)
    end

    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE cats_warehouse_inventory_lots
          SET status = 'Active'
          WHERE status IS NULL
        SQL

        execute <<~SQL
          UPDATE cats_warehouse_uom_conversions
          SET active = TRUE
          WHERE active IS NULL
        SQL
      end
    end
  end
end
