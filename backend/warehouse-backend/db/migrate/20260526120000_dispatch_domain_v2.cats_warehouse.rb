# frozen_string_literal: true

class DispatchDomainV2 < ActiveRecord::Migration[7.0]
  def change
    change_table :cats_warehouse_dispatch_orders, bulk: true do |t|
      t.string :plan_reference unless column_exists?(:cats_warehouse_dispatch_orders, :plan_reference)
      t.string :officer_level unless column_exists?(:cats_warehouse_dispatch_orders, :officer_level)
      t.bigint :officer_location_id unless column_exists?(:cats_warehouse_dispatch_orders, :officer_location_id)
      t.jsonb :jurisdiction_metadata, default: {} unless column_exists?(:cats_warehouse_dispatch_orders, :jurisdiction_metadata)
      t.bigint :approved_by_id unless column_exists?(:cats_warehouse_dispatch_orders, :approved_by_id)
      t.datetime :approved_at unless column_exists?(:cats_warehouse_dispatch_orders, :approved_at)
      t.bigint :dispatch_plan_id unless column_exists?(:cats_warehouse_dispatch_orders, :dispatch_plan_id)
      t.bigint :dispatch_plan_item_id unless column_exists?(:cats_warehouse_dispatch_orders, :dispatch_plan_item_id)
    end

    add_index :cats_warehouse_dispatch_orders, :plan_reference unless index_exists?(:cats_warehouse_dispatch_orders, :plan_reference)
    add_index :cats_warehouse_dispatch_orders, [:created_by_id, :status], name: "idx_cw_do_created_by_status" unless index_exists?(:cats_warehouse_dispatch_orders, [:created_by_id, :status], name: "idx_cw_do_created_by_status")
    add_index :cats_warehouse_dispatch_orders, [:officer_level, :status], name: "idx_cw_do_officer_level_status" unless index_exists?(:cats_warehouse_dispatch_orders, [:officer_level, :status], name: "idx_cw_do_officer_level_status")

    unless foreign_key_exists?(:cats_warehouse_dispatch_orders, column: :officer_location_id)
      add_foreign_key :cats_warehouse_dispatch_orders, :cats_core_locations, column: :officer_location_id
    end
    unless foreign_key_exists?(:cats_warehouse_dispatch_orders, column: :approved_by_id)
      add_foreign_key :cats_warehouse_dispatch_orders, :cats_core_users, column: :approved_by_id
    end

    change_table :cats_warehouse_dispatch_order_lines, bulk: true do |t|
      t.bigint :base_unit_id unless column_exists?(:cats_warehouse_dispatch_order_lines, :base_unit_id)
      t.decimal :base_quantity, precision: 18, scale: 6 unless column_exists?(:cats_warehouse_dispatch_order_lines, :base_quantity)
      t.bigint :packaging_unit_id unless column_exists?(:cats_warehouse_dispatch_order_lines, :packaging_unit_id)
      t.decimal :packaging_size, precision: 18, scale: 6 unless column_exists?(:cats_warehouse_dispatch_order_lines, :packaging_size)
      t.integer :package_count unless column_exists?(:cats_warehouse_dispatch_order_lines, :package_count)
      t.text :remarks unless column_exists?(:cats_warehouse_dispatch_order_lines, :remarks)
    end

    unless table_exists?(:cats_warehouse_dispatch_line_source_allocations)
      create_table :cats_warehouse_dispatch_line_source_allocations do |t|
        t.references :dispatch_order_line, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_order_lines },
          index: { name: "idx_cw_dlsa_line" }
        t.references :warehouse, null: false,
          foreign_key: { to_table: :cats_warehouse_warehouses },
          index: { name: "idx_cw_dlsa_warehouse" }
        t.decimal :quantity, precision: 18, scale: 6, null: false
        t.bigint :unit_id, null: false
        t.decimal :base_quantity, precision: 18, scale: 6
        t.bigint :base_unit_id
        t.string :warehouse_ownership_type
        t.timestamps
      end
      add_index :cats_warehouse_dispatch_line_source_allocations, :unit_id, name: "idx_cw_dlsa_unit"
      add_foreign_key :cats_warehouse_dispatch_line_source_allocations, :cats_core_unit_of_measures, column: :unit_id
      add_foreign_key :cats_warehouse_dispatch_line_source_allocations, :cats_core_unit_of_measures, column: :base_unit_id
    end

    unless table_exists?(:cats_warehouse_dispatch_line_destination_allocations)
      create_table :cats_warehouse_dispatch_line_destination_allocations do |t|
        t.references :dispatch_order_line, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_order_lines },
          index: { name: "idx_cw_dlda_line" }
        t.bigint :destination_location_id, null: false
        t.string :destination_location_type
        t.decimal :quantity, precision: 18, scale: 6, null: false
        t.bigint :unit_id, null: false
        t.decimal :base_quantity, precision: 18, scale: 6
        t.bigint :base_unit_id
        t.timestamps
      end
      add_index :cats_warehouse_dispatch_line_destination_allocations, :destination_location_id, name: "idx_cw_dlda_dest_loc"
      add_index :cats_warehouse_dispatch_line_destination_allocations, :unit_id, name: "idx_cw_dlda_unit"
      add_foreign_key :cats_warehouse_dispatch_line_destination_allocations, :cats_core_locations, column: :destination_location_id
      add_foreign_key :cats_warehouse_dispatch_line_destination_allocations, :cats_core_unit_of_measures, column: :unit_id
      add_foreign_key :cats_warehouse_dispatch_line_destination_allocations, :cats_core_unit_of_measures, column: :base_unit_id
    end

    unless table_exists?(:cats_warehouse_dispatch_order_authorizations)
      create_table :cats_warehouse_dispatch_order_authorizations do |t|
        t.references :dispatch_order, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_orders },
          index: { name: "idx_cw_doa_order" }
        t.references :warehouse, null: false,
          foreign_key: { to_table: :cats_warehouse_warehouses },
          index: { name: "idx_cw_doa_warehouse" }
        t.string :reference_no
        t.string :status, null: false, default: "draft"
        t.decimal :authorized_quantity, precision: 18, scale: 6, null: false
        t.decimal :authorized_base_quantity, precision: 18, scale: 6
        t.bigint :authorized_quantity_input_unit_id
        t.decimal :remaining_quantity, precision: 18, scale: 6
        t.bigint :transporter_id, null: false
        t.string :driver_name
        t.string :driver_id_number
        t.string :truck_plate_number
        t.string :transporter_name
        t.bigint :created_by_id, null: false
        t.bigint :confirmed_by_id
        t.datetime :confirmed_at
        t.datetime :driver_confirmed_at
        t.bigint :driver_confirmed_by_id
        t.datetime :cancelled_at
        t.bigint :cancelled_by_id
        t.timestamps
      end
      add_index :cats_warehouse_dispatch_order_authorizations, :reference_no, unique: true, name: "idx_cw_doa_reference_no"
      add_index :cats_warehouse_dispatch_order_authorizations, :status, name: "idx_cw_doa_status"
      add_index :cats_warehouse_dispatch_order_authorizations, [:dispatch_order_id, :warehouse_id], name: "idx_cw_doa_order_wh"
      add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_transporters, column: :transporter_id
      add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_users, column: :created_by_id
      add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_unit_of_measures, column: :authorized_quantity_input_unit_id
      add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_users, column: :confirmed_by_id
      add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_users, column: :driver_confirmed_by_id
      add_foreign_key :cats_warehouse_dispatch_order_authorizations, :cats_core_users, column: :cancelled_by_id
    end

    unless table_exists?(:cats_warehouse_dispatch_order_authorization_stores)
      create_table :cats_warehouse_dispatch_order_authorization_stores do |t|
        t.references :dispatch_order_authorization, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_order_authorizations },
          index: { name: "idx_cw_doas_auth" }
        t.bigint :store_id, null: false
        t.bigint :commodity_id, null: false
        t.decimal :authorized_quantity, precision: 18, scale: 6, null: false
        t.decimal :base_quantity, precision: 18, scale: 6
        t.decimal :dispatched_quantity, precision: 18, scale: 6, default: 0
        t.decimal :remaining_quantity, precision: 18, scale: 6
        t.timestamps
      end
      add_index :cats_warehouse_dispatch_order_authorization_stores, :store_id, name: "idx_cw_doas_store"
      add_index :cats_warehouse_dispatch_order_authorization_stores, :commodity_id, name: "idx_cw_doas_commodity"
      add_foreign_key :cats_warehouse_dispatch_order_authorization_stores, :cats_warehouse_stores, column: :store_id
      add_foreign_key :cats_warehouse_dispatch_order_authorization_stores, :cats_core_commodities, column: :commodity_id
    end

    unless table_exists?(:cats_warehouse_dispatch_order_authorization_executions)
      create_table :cats_warehouse_dispatch_order_authorization_executions do |t|
        t.references :dispatch_order_authorization, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_order_authorizations },
          index: { name: "idx_cw_doae_auth" }
        t.references :dispatch_order_authorization_store, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_order_authorization_stores },
          index: { name: "idx_cw_doae_store_row" }
        t.bigint :storekeeper_id, null: false
        t.bigint :commodity_id, null: false
        t.decimal :quantity, precision: 18, scale: 6, null: false
        t.decimal :base_quantity, precision: 18, scale: 6
        t.decimal :authorized_quantity, precision: 18, scale: 6
        t.decimal :shortage_quantity, precision: 18, scale: 6, default: 0
        t.text :shortage_reason
        t.string :commodity_grade
        t.bigint :inventory_lot_id
        t.string :status, null: false, default: "draft"
        t.timestamps
      end
      add_index :cats_warehouse_dispatch_order_authorization_executions, :commodity_id, name: "idx_cw_doae_commodity"
      add_foreign_key :cats_warehouse_dispatch_order_authorization_executions, :cats_core_users, column: :storekeeper_id
      add_foreign_key :cats_warehouse_dispatch_order_authorization_executions, :cats_core_commodities, column: :commodity_id
    end

    unless table_exists?(:cats_warehouse_dispatch_stack_allocations)
      create_table :cats_warehouse_dispatch_stack_allocations do |t|
        t.references :dispatch_order_authorization_execution,
          foreign_key: { to_table: :cats_warehouse_dispatch_order_authorization_executions },
          index: { name: "idx_cw_dsa_execution" }
        t.references :gin, foreign_key: { to_table: :cats_warehouse_gins }, index: { name: "idx_cw_dsa_gin" }
        t.bigint :stack_id, null: false
        t.decimal :quantity, precision: 18, scale: 6, null: false
        t.decimal :base_quantity, precision: 18, scale: 6
        t.string :commodity_grade
        t.timestamps
      end
      add_index :cats_warehouse_dispatch_stack_allocations, :stack_id, name: "idx_cw_dsa_stack"
      add_foreign_key :cats_warehouse_dispatch_stack_allocations, :cats_warehouse_stacks, column: :stack_id
    end

    unless table_exists?(:cats_warehouse_transport_records)
      create_table :cats_warehouse_transport_records do |t|
        t.references :dispatch_order, null: false,
          foreign_key: { to_table: :cats_warehouse_dispatch_orders },
          index: { name: "idx_cw_tr_order" }
        t.references :warehouse, null: false,
          foreign_key: { to_table: :cats_warehouse_warehouses },
          index: { name: "idx_cw_tr_warehouse" }
        t.string :driver_name, null: false
        t.string :license_number
        t.string :vehicle_plate, null: false
        t.string :phone
        t.bigint :recorded_by_id, null: false
        t.timestamps
      end
      add_index :cats_warehouse_transport_records, [:dispatch_order_id, :warehouse_id], unique: true, name: "idx_cw_tr_order_wh_unique"
      add_foreign_key :cats_warehouse_transport_records, :cats_core_users, column: :recorded_by_id
    end

    unless table_exists?(:cats_warehouse_packaging_transactions)
      create_table :cats_warehouse_packaging_transactions do |t|
        t.string :transaction_type, null: false
        t.references :warehouse, null: false, foreign_key: { to_table: :cats_warehouse_warehouses }, index: { name: "idx_cw_pt_wh" }
        t.bigint :commodity_id, null: false
        t.decimal :quantity, precision: 18, scale: 6, null: false
        t.decimal :base_quantity, precision: 18, scale: 6
        t.bigint :unit_id, null: false
        t.bigint :packaging_unit_id
        t.decimal :packaging_size, precision: 18, scale: 6
        t.integer :package_count
        t.datetime :occurred_at, null: false
        t.string :reference_order_type, null: false
        t.bigint :reference_order_id, null: false
        t.bigint :dispatch_order_authorization_execution_id
        t.bigint :created_by_id, null: false
        t.string :status, null: false, default: "posted"
        t.timestamps
      end
      add_index :cats_warehouse_packaging_transactions, [:reference_order_type, :reference_order_id], name: "idx_cw_pt_reference"
      add_index :cats_warehouse_packaging_transactions, :commodity_id, name: "idx_cw_pt_commodity"
      add_index :cats_warehouse_packaging_transactions, :unit_id, name: "idx_cw_pt_unit"
      add_foreign_key :cats_warehouse_packaging_transactions, :cats_core_commodities, column: :commodity_id
      add_foreign_key :cats_warehouse_packaging_transactions, :cats_core_unit_of_measures, column: :unit_id
      add_foreign_key :cats_warehouse_packaging_transactions, :cats_core_unit_of_measures, column: :packaging_unit_id
      add_foreign_key :cats_warehouse_packaging_transactions, :cats_core_users, column: :created_by_id
    end

    unless column_exists?(:cats_warehouse_waybills, :dispatch_order_authorization_id)
      add_reference :cats_warehouse_waybills, :dispatch_order_authorization,
        foreign_key: { to_table: :cats_warehouse_dispatch_order_authorizations },
        index: { name: "idx_cw_waybills_doa" }
    end

    unless column_exists?(:cats_warehouse_gins, :dispatch_order_authorization_id)
      add_reference :cats_warehouse_gins, :dispatch_order_authorization,
        foreign_key: { to_table: :cats_warehouse_dispatch_order_authorizations },
        index: { name: "idx_cw_gins_doa" }
    end

    unless column_exists?(:cats_warehouse_stock_reservations, :dispatch_order_authorization_id)
      add_reference :cats_warehouse_stock_reservations, :dispatch_order_authorization,
        foreign_key: { to_table: :cats_warehouse_dispatch_order_authorizations },
        index: { name: "idx_cw_stock_res_doa" }
    end
  end
end
