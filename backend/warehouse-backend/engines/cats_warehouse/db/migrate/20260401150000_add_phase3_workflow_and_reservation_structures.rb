class AddPhase3WorkflowAndReservationStructures < ActiveRecord::Migration[7.1]
  def change
    create_table :cats_warehouse_receipt_order_assignments do |t|
      t.references :receipt_order, null: false, foreign_key: { to_table: :cats_warehouse_receipt_orders }
      t.references :receipt_order_line, foreign_key: { to_table: :cats_warehouse_receipt_order_lines }
      t.references :hub, foreign_key: { to_table: :cats_warehouse_hubs }
      t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :store, foreign_key: { to_table: :cats_warehouse_stores }
      t.references :assigned_by, null: false, foreign_key: { to_table: :cats_core_users }
      t.references :assigned_to, foreign_key: { to_table: :cats_core_users }
      t.decimal :quantity, precision: 15, scale: 3
      t.string :status, null: false, default: "Assigned"
      t.timestamps
    end
    add_index :cats_warehouse_receipt_order_assignments, :status

    create_table :cats_warehouse_dispatch_order_assignments do |t|
      t.references :dispatch_order, null: false, foreign_key: { to_table: :cats_warehouse_dispatch_orders }
      t.references :dispatch_order_line, foreign_key: { to_table: :cats_warehouse_dispatch_order_lines }
      t.references :hub, foreign_key: { to_table: :cats_warehouse_hubs }
      t.references :warehouse, foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :store, foreign_key: { to_table: :cats_warehouse_stores }
      t.references :assigned_by, null: false, foreign_key: { to_table: :cats_core_users }
      t.references :assigned_to, foreign_key: { to_table: :cats_core_users }
      t.decimal :quantity, precision: 15, scale: 3
      t.string :status, null: false, default: "Assigned"
      t.timestamps
    end
    add_index :cats_warehouse_dispatch_order_assignments, :status

    create_table :cats_warehouse_space_reservations do |t|
      t.references :receipt_order, null: false, foreign_key: { to_table: :cats_warehouse_receipt_orders }
      t.references :receipt_order_line, null: false, foreign_key: { to_table: :cats_warehouse_receipt_order_lines }
      t.references :receipt_order_assignment, foreign_key: { to_table: :cats_warehouse_receipt_order_assignments }
      t.references :warehouse, null: false, foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :store, foreign_key: { to_table: :cats_warehouse_stores }
      t.decimal :reserved_quantity, precision: 15, scale: 3
      t.decimal :reserved_volume, precision: 15, scale: 3
      t.string :status, null: false, default: "Reserved"
      t.references :reserved_by, null: false, foreign_key: { to_table: :cats_core_users }
      t.timestamps
    end
    add_index :cats_warehouse_space_reservations, :status
    add_index :cats_warehouse_space_reservations,
              [:receipt_order_line_id, :warehouse_id, :store_id],
              unique: true,
              name: "idx_cw_space_reservations_line_location"

    create_table :cats_warehouse_stock_reservations do |t|
      t.references :dispatch_order, null: false, foreign_key: { to_table: :cats_warehouse_dispatch_orders }
      t.references :dispatch_order_line, null: false, foreign_key: { to_table: :cats_warehouse_dispatch_order_lines }
      t.references :warehouse, null: false, foreign_key: { to_table: :cats_warehouse_warehouses }
      t.references :store, foreign_key: { to_table: :cats_warehouse_stores }
      t.references :stack, foreign_key: { to_table: :cats_warehouse_stacks }
      t.references :commodity, null: false, foreign_key: { to_table: :cats_core_commodities }
      t.references :unit, null: false, foreign_key: { to_table: :cats_core_unit_of_measures }
      t.references :inventory_lot, foreign_key: { to_table: :cats_warehouse_inventory_lots }
      t.decimal :reserved_quantity, precision: 15, scale: 3, null: false
      t.decimal :issued_quantity, precision: 15, scale: 3, null: false, default: 0
      t.string :status, null: false, default: "Reserved"
      t.references :reserved_by, null: false, foreign_key: { to_table: :cats_core_users }
      t.timestamps
    end
    add_index :cats_warehouse_stock_reservations, :status
    add_index :cats_warehouse_stock_reservations,
              [:dispatch_order_line_id, :warehouse_id, :store_id, :stack_id, :inventory_lot_id],
              unique: true,
              name: "idx_cw_stock_reservations_line_location"

    create_table :cats_warehouse_workflow_events do |t|
      t.string :entity_type, null: false
      t.bigint :entity_id, null: false
      t.string :event_type, null: false
      t.string :from_status
      t.string :to_status
      t.references :actor, foreign_key: { to_table: :cats_core_users }
      t.jsonb :payload
      t.datetime :occurred_at, null: false
      t.timestamps
    end
    add_index :cats_warehouse_workflow_events, [:entity_type, :entity_id, :occurred_at], name: "idx_cw_workflow_events_entity_time"
    add_index :cats_warehouse_workflow_events, :event_type

    change_table :cats_warehouse_inspections do |t|
      t.references :dispatch_order, foreign_key: { to_table: :cats_warehouse_dispatch_orders } unless column_exists?(:cats_warehouse_inspections, :dispatch_order_id)
      t.string :result_status unless column_exists?(:cats_warehouse_inspections, :result_status)
      t.references :auto_generated_grn, foreign_key: { to_table: :cats_warehouse_grns } unless column_exists?(:cats_warehouse_inspections, :auto_generated_grn_id)
      t.references :auto_generated_gin, foreign_key: { to_table: :cats_warehouse_gins } unless column_exists?(:cats_warehouse_inspections, :auto_generated_gin_id)
    end

    change_table :cats_warehouse_grns do |t|
      t.string :workflow_status unless column_exists?(:cats_warehouse_grns, :workflow_status)
      t.references :generated_from_inspection, foreign_key: { to_table: :cats_warehouse_inspections } unless column_exists?(:cats_warehouse_grns, :generated_from_inspection_id)
    end

    change_table :cats_warehouse_gins do |t|
      t.string :workflow_status unless column_exists?(:cats_warehouse_gins, :workflow_status)
      t.references :generated_from_waybill, foreign_key: { to_table: :cats_warehouse_waybills } unless column_exists?(:cats_warehouse_gins, :generated_from_waybill_id)
    end

    change_table :cats_warehouse_waybills do |t|
      t.references :dispatch_order, foreign_key: { to_table: :cats_warehouse_dispatch_orders } unless column_exists?(:cats_warehouse_waybills, :dispatch_order_id)
      t.references :prepared_by, foreign_key: { to_table: :cats_core_users } unless column_exists?(:cats_warehouse_waybills, :prepared_by_id)
      t.string :workflow_status unless column_exists?(:cats_warehouse_waybills, :workflow_status)
      t.references :auto_generated_gin, foreign_key: { to_table: :cats_warehouse_gins } unless column_exists?(:cats_warehouse_waybills, :auto_generated_gin_id)
    end

    change_table :cats_warehouse_stock_balances do |t|
      t.decimal :reserved_quantity, precision: 15, scale: 3, null: false, default: 0 unless column_exists?(:cats_warehouse_stock_balances, :reserved_quantity)
      t.decimal :available_quantity, precision: 15, scale: 3 unless column_exists?(:cats_warehouse_stock_balances, :available_quantity)
    end
  end
end
