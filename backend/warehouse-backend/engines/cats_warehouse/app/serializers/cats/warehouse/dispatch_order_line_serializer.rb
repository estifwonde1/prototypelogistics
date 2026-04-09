module Cats
  module Warehouse
    class DispatchOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name

      def commodity_name
        commodity = Cats::Core::Commodity.find_by(id: object.commodity_id)
        return unless commodity

        commodity.read_attribute(:name).presence || commodity.batch_no.presence
      end

      def unit_name
        # Reload the unit to ensure we have the right object
        unit = Cats::Core::UnitOfMeasure.find_by(id: object.unit_id)
        unit&.abbreviation
      end
    end
  end
end
