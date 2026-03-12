# This migration comes from cats_warehouse (originally 20260312191330)
class CreateCatsWarehouseWaybillTransport < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_waybill_transport do |t|
      t.references :waybill,
                   null: false,
                   foreign_key: {to_table: :cats_warehouse_waybills}
      t.references :transporter,
                   null: false,
                   foreign_key: {to_table: :cats_core_transporters}
      t.string :vehicle_plate_no
      t.string :driver_name
      t.string :driver_phone

      t.timestamps
    end
  end
end
