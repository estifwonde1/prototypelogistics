module Cats
  module Warehouse
    class DispatchOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name,
                 :warehouse_id, :warehouse_name, :hub_id, :hub_name,
                 :fdp_id, :fdp_name, :expected_receive_at, :source_name

      def commodity_name
        c = object.commodity
        return unless c

        c.read_attribute(:name).presence || c.batch_no.presence
      end

      def unit_name
        object.unit&.abbreviation || object.unit&.name
      end

      def warehouse_name
        object.warehouse&.name
      end

      def hub_name
        object.hub&.name || object.warehouse&.hub&.name
      end

      def fdp_name
        object.fdp&.name
      end

      # NEW: source_name intelligently returns the appropriate source facility name
      # For hub-affiliated warehouses: returns hub name
      # For independent warehouses: returns warehouse name
      def source_name
        warehouse = object.warehouse
        return nil if warehouse.nil?

        # If warehouse is affiliated with a hub, return the hub name
        if warehouse.hub_id.present?
          warehouse.hub&.name
        else
          # Independent warehouse: return the warehouse name
          warehouse.name
        end
      end
    end
  end
end
