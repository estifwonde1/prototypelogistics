# frozen_string_literal: true

class RecalculateStoreVolumesWithoutDoubleUsablePct < ActiveRecord::Migration[7.0]
  def up
    return unless table_exists?(:cats_warehouse_stores)

    Cats::Warehouse::Store.reset_column_information
    Cats::Warehouse::Store.find_each do |store|
      store.send(:calculate_capacity_metrics)
      store.save!(validate: false) if store.changed?
      Cats::Warehouse::StoreOccupancyUpdater.call(store: store)
    end
  end

  def down
    # Irreversible data correction
  end
end
