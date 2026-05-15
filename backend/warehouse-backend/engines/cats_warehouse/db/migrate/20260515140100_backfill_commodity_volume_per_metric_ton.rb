# frozen_string_literal: true

class BackfillCommodityVolumePerMetricTon < ActiveRecord::Migration[7.0]
  DEFAULT_DENSITY = 1.25

  def up
    if table_exists?(:cats_core_commodities)
      execute <<-SQL.squish
        UPDATE cats_core_commodities
        SET volume_per_metric_ton = #{DEFAULT_DENSITY}
        WHERE volume_per_metric_ton IS NULL OR volume_per_metric_ton <= 0
      SQL
    end

    return unless table_exists?(:cats_warehouse_commodity_definitions)

    return unless column_exists?(:cats_warehouse_commodity_definitions, :volume_per_metric_ton)

    execute <<-SQL.squish
      UPDATE cats_warehouse_commodity_definitions
      SET volume_per_metric_ton = #{DEFAULT_DENSITY}
      WHERE volume_per_metric_ton IS NULL OR volume_per_metric_ton <= 0
    SQL
  end

  def down
    # Irreversible data correction
  end
end
