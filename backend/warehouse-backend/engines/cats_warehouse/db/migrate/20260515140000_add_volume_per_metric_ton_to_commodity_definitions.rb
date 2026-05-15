# frozen_string_literal: true

class AddVolumePerMetricTonToCommodityDefinitions < ActiveRecord::Migration[7.0]
  def change
    add_column :cats_warehouse_commodity_definitions,
               :volume_per_metric_ton,
               :float,
               default: 1.25,
               null: false
  end
end
