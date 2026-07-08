# frozen_string_literal: true

class AddCapacityDimensionsAndVolumeTracking < ActiveRecord::Migration[7.0]
  def up
    change_table :cats_warehouse_warehouse_capacity, bulk: true do |t|
      t.decimal :length_m, precision: 15, scale: 4
      t.decimal :width_m, precision: 15, scale: 4
      t.decimal :height_m, precision: 15, scale: 4
      t.decimal :usable_volume_m3, precision: 15, scale: 4
      t.datetime :capacity_established_at
    end

    change_table :cats_warehouse_stores, bulk: true do |t|
      t.decimal :usable_volume_m3, precision: 15, scale: 4
      t.decimal :occupied_volume_m3, precision: 15, scale: 4, default: 0, null: false
      t.decimal :available_volume_m3, precision: 15, scale: 4
      t.decimal :allocated_capacity_mt, precision: 15, scale: 4
    end

    add_column :cats_warehouse_stacks, :max_capacity_mt, :decimal, precision: 15, scale: 4

    backfill_warehouse_capacities
    backfill_stores
    backfill_stacks
  end

  def down
    remove_column :cats_warehouse_stacks, :max_capacity_mt
    change_table :cats_warehouse_stores, bulk: true do |t|
      t.remove :usable_volume_m3, :occupied_volume_m3, :available_volume_m3, :allocated_capacity_mt
    end
    change_table :cats_warehouse_warehouse_capacity, bulk: true do |t|
      t.remove :length_m, :width_m, :height_m, :usable_volume_m3, :capacity_established_at
    end
  end

  private

  def backfill_warehouse_capacities
    say_with_time "Backfilling warehouse capacities from legacy area/MT" do
      execute <<~SQL.squish
        UPDATE cats_warehouse_warehouse_capacity
        SET length_m = CASE
              WHEN total_area_sqm IS NOT NULL AND total_area_sqm > 0
              THEN SQRT(total_area_sqm)
              ELSE NULL
            END,
            width_m = CASE
              WHEN total_area_sqm IS NOT NULL AND total_area_sqm > 0
              THEN SQRT(total_area_sqm)
              ELSE NULL
            END,
            height_m = 10,
            capacity_established_at = CASE
              WHEN total_storage_capacity_mt IS NOT NULL AND total_storage_capacity_mt > 0
              THEN updated_at
              ELSE NULL
            END
        WHERE length_m IS NULL
      SQL
    end

    # Re-derive via Ruby for rows with dimensions
    Cats::Warehouse::WarehouseCapacity.reset_column_information
    Cats::Warehouse::WarehouseCapacity.find_each do |cap|
      next if cap.length_m.blank? || cap.width_m.blank? || cap.height_m.blank?

      cap.send(:derive_capacity_from_dimensions)
      cap.save!(validate: false) if cap.changed?
    end
  end

  def backfill_stores
    Cats::Warehouse::Store.reset_column_information
    Cats::Warehouse::Store.find_each do |store|
      store.send(:calculate_capacity_metrics)
      store.save!(validate: false) if store.changed?
      Cats::Warehouse::StoreOccupancyUpdater.call(store: store)
    end
  end

  def backfill_stacks
    Cats::Warehouse::Stack.reset_column_information
    Cats::Warehouse::Stack.find_each do |stack|
      stack.send(:derive_max_capacity_mt)
      stack.save!(validate: false) if stack.changed?
    end
  end
end
