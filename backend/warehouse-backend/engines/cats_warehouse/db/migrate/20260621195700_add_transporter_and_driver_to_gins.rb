class AddTransporterAndDriverToCatsWarehouseGins < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_gins, :transporter_id, :bigint
    add_column :cats_warehouse_gins, :truck_plate_number, :string
    add_column :cats_warehouse_gins, :driver_name, :string
    add_column :cats_warehouse_gins, :driver_id_number, :string
    add_column :cats_warehouse_gins, :driver_confirmed_at, :datetime
    add_column :cats_warehouse_gins, :driver_confirmed_by_id, :bigint

    add_index :cats_warehouse_gins, :transporter_id
    add_index :cats_warehouse_gins, :driver_confirmed_by_id
  end
end
