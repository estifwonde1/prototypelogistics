module Cats
  module Warehouse
    class HubCapacityRecalculator
      def self.call(hub_or_id)
        hub = hub_or_id.is_a?(Hub) ? hub_or_id : Hub.find_by(id: hub_or_id)
        return unless hub

        capacities = WarehouseCapacity.joins(:warehouse).where(
          cats_warehouse_warehouses: { hub_id: hub.id }
        )

        capacity = hub.hub_capacity || HubCapacity.new(hub: hub)
        capacity.total_area_sqm = capacities.sum(:total_area_sqm).to_f
        capacity.total_capacity_mt = capacities.sum(:total_storage_capacity_mt).to_f
        capacity.save!
      end
    end
  end
end
