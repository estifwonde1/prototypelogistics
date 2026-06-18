module Cats
  module Warehouse
    class DispatchOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name,
                 :warehouse_id, :warehouse_name, :hub_id, :hub_name,
                 :fdp_id, :fdp_name, :expected_receive_at

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
    end
  end
end
