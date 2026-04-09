# This migration comes from cats_warehouse (originally 20260331230000)
class CreateCatsWarehouseOrders < ActiveRecord::Migration[7.0]
  def change
    unless table_exists?(:cats_warehouse_receipt_orders)
      create_table :cats_warehouse_receipt_orders do |t|
        t.string :reference_no, null: false, index: { unique: true }
        t.string :status, null: false, default: "Draft", index: true
        t.references :hub, foreign_key: { to_table: :cats_warehouse_hubs }
        t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses }
        t.string :source_type
        t.bigint :source_id
        t.string :source_document_no
        t.date :received_date
        t.references :created_by, foreign_key: { to_table: :cats_core_users }
        t.references :confirmed_by, foreign_key: { to_table: :cats_core_users }
        t.text :description

        t.timestamps
      end
    end

    unless table_exists?(:cats_warehouse_receipt_order_lines)
      create_table :cats_warehouse_receipt_order_lines do |t|
        t.references :receipt_order, null: false, foreign_key: { to_table: :cats_warehouse_receipt_orders }, index: { name: "index_receipt_order_lines_on_order_id" }
        t.references :commodity, null: false, foreign_key: { to_table: :cats_core_commodities }
        t.decimal :quantity, precision: 15, scale: 2, null: false
        t.references :unit, null: false, foreign_key: { to_table: :cats_core_unit_of_measures }

        t.timestamps
      end
    end

    if table_exists?(:cats_warehouse_dispatch_orders)
      change_table :cats_warehouse_dispatch_orders do |t|
        t.references :hub, foreign_key: { to_table: :cats_warehouse_hubs } unless column_exists?(:cats_warehouse_dispatch_orders, :hub_id)
        t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses } unless column_exists?(:cats_warehouse_dispatch_orders, :warehouse_id)
        t.string :destination_type unless column_exists?(:cats_warehouse_dispatch_orders, :destination_type)
        t.bigint :destination_id unless column_exists?(:cats_warehouse_dispatch_orders, :destination_id)
        t.string :source_document_no unless column_exists?(:cats_warehouse_dispatch_orders, :source_document_no)
        t.date :dispatched_date unless column_exists?(:cats_warehouse_dispatch_orders, :dispatched_date)
        t.references :created_by, foreign_key: { to_table: :cats_core_users } unless column_exists?(:cats_warehouse_dispatch_orders, :created_by_id)
        t.references :confirmed_by, foreign_key: { to_table: :cats_core_users } unless column_exists?(:cats_warehouse_dispatch_orders, :confirmed_by_id)
        t.text :description unless column_exists?(:cats_warehouse_dispatch_orders, :description)
      end
    else
      create_table :cats_warehouse_dispatch_orders do |t|
        t.string :reference_no, null: false, index: { unique: true }
        t.string :status, null: false, default: "Draft", index: true
        t.references :hub, foreign_key: { to_table: :cats_warehouse_hubs }
        t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses }
        t.string :destination_type
        t.bigint :destination_id
        t.string :source_document_no
        t.date :dispatched_date
        t.references :created_by, foreign_key: { to_table: :cats_core_users }
        t.references :confirmed_by, foreign_key: { to_table: :cats_core_users }
        t.text :description

        t.timestamps
      end
    end

    unless table_exists?(:cats_warehouse_dispatch_order_lines)
      create_table :cats_warehouse_dispatch_order_lines do |t|
        t.references :dispatch_order, null: false, foreign_key: { to_table: :cats_warehouse_dispatch_orders }, index: { name: "index_dispatch_order_lines_on_order_id" }
        t.references :commodity, null: false, foreign_key: { to_table: :cats_core_commodities }
        t.decimal :quantity, precision: 15, scale: 2, null: false
        t.references :unit, null: false, foreign_key: { to_table: :cats_core_unit_of_measures }

        t.timestamps
      end
    end
  end
end
