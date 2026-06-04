module Cats
  module Warehouse
    class HubCapacitySerializer < ApplicationSerializer
      attributes :id, :hub_id, :total_area_sqm, :total_capacity_mt, :construction_year,
                 :used_capacity_mt, :remaining_capacity_mt, :utilization_pct,
                 :created_at, :updated_at

      def used_capacity_mt
        rollup[:used_mt]
      end

      def remaining_capacity_mt
        rollup[:remaining_mt]
      end

      def utilization_pct
        rollup[:utilization_pct]
      end

      private

      def rollup
        @rollup ||= self.class.rollup_for_hub(object.hub_id)
      end

      class << self
        def rollup_for_hub(hub_id)
          cache = Thread.current[:hub_capacity_rollup_cache] ||= {}
          cache[hub_id] ||= compute_rollup(hub_id)
        end

        def compute_rollup(hub_id)
          capacity_mt = WarehouseCapacity
            .joins(:warehouse)
            .where(cats_warehouse_warehouses: { hub_id: hub_id })
            .sum(:usable_storage_capacity_mt)
            .to_f

          warehouse_ids = Warehouse.where(hub_id: hub_id).pluck(:id)
          used_mt = if warehouse_ids.empty?
                      0.0
                    else
                      StockBalance.where(warehouse_id: warehouse_ids).sum(:base_quantity).to_f
                    end

          remaining = [ capacity_mt - used_mt, 0 ].max
          utilization = capacity_mt.positive? ? ((used_mt / capacity_mt) * 100.0).round(2) : 0.0

          {
            used_mt: used_mt.round(4),
            remaining_mt: remaining.round(4),
            utilization_pct: utilization
          }
        end
      end
    end
  end
end
