module Cats
  module Warehouse
    class DispatchOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name

      def commodity_name
        c = object.commodity
        return unless c
        c.read_attribute(:name).presence || c.batch_no.presence
      end

      def unit_name
        object.unit&.abbreviation
      end
    end
  end
end
