class CreateCatsWarehouseReceiptAuthorizations < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_receipt_authorizations do |t|
      # Core links
      t.references :receipt_order, null: false,
        foreign_key: { to_table: :cats_warehouse_receipt_orders }
      t.bigint :receipt_order_assignment_id,
        null: true
      t.index :receipt_order_assignment_id, name: "idx_cw_ra_on_roa_id"

      # Destination
      t.references :store, null: false,
        foreign_key: { to_table: :cats_warehouse_stores }
      t.references :warehouse, null: false,
        foreign_key: { to_table: :cats_warehouse_warehouses }

      # Transport
      t.references :transporter, null: false,
        foreign_key: { to_table: :cats_core_transporters }
      t.string  :driver_name,       null: false
      t.string  :driver_id_number,  null: false
      t.string  :truck_plate_number, null: false
      t.string  :waybill_number,    null: false

      # Quantity
      t.decimal :authorized_quantity, precision: 15, scale: 3, null: false

      # Status & lifecycle
      t.string  :reference_no
      t.string  :status, null: false, default: "pending"

      # Driver confirmation
      t.datetime :driver_confirmed_at
      t.bigint :driver_confirmed_by_id, null: true
      t.index :driver_confirmed_by_id, name: "idx_cw_ra_on_driver_confirmed_by"

      # Cancellation
      t.datetime :cancelled_at
      t.bigint :cancelled_by_id, null: true
      t.index :cancelled_by_id, name: "idx_cw_ra_on_cancelled_by"

      # Audit
      t.references :created_by, null: false,
        foreign_key: { to_table: :cats_core_users }

      t.timestamps
    end

    add_index :cats_warehouse_receipt_authorizations, :reference_no, unique: true
    add_index :cats_warehouse_receipt_authorizations, :status
    add_index :cats_warehouse_receipt_authorizations,
              [:receipt_order_id, :status],
              name: "idx_cw_ra_order_status"

    add_foreign_key :cats_warehouse_receipt_authorizations,
                    :cats_warehouse_receipt_order_assignments,
                    column: :receipt_order_assignment_id
    add_foreign_key :cats_warehouse_receipt_authorizations,
                    :cats_core_users,
                    column: :driver_confirmed_by_id
    add_foreign_key :cats_warehouse_receipt_authorizations,
                    :cats_core_users,
                    column: :cancelled_by_id
  end
end
