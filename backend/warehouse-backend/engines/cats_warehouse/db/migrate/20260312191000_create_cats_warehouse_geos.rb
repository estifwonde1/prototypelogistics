class CreateCatsWarehouseGeos < ActiveRecord::Migration[7.0]
  def change
    create_table :cats_warehouse_geos do |t|
      t.float :latitude
      t.float :longitude
      t.float :altitude_m
      t.string :address
      t.string :source
      t.datetime :captured_at

      t.timestamps
    end
  end
end
