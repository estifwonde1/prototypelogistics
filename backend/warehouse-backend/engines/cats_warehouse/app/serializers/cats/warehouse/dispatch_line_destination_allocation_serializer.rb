# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchLineDestinationAllocationSerializer < ApplicationSerializer
      attributes :id, :destination_location_id, :destination_location_type,
                 :quantity, :unit_id, :base_quantity, :base_unit_id,
                 :unit_name, :base_unit_name, :destination_label,
                 :destination_warehouse_id, :destination_warehouse_name

      belongs_to :destination_location, serializer: LookupOptionSerializer

      # Warehouse destinations are stored by core location_id; show the warehouse name the officer picked,
      # not the jurisdiction location record name (e.g. "Kebele 1" vs "Bole Central Warehouse").
      def destination_label
        wh = warehouse_at_destination
        if wh
          code = wh.code.presence
          return code ? "#{wh.name} (#{code})" : wh.name
        end

        loc = object.destination_location
        return unless loc

        code = loc.code.presence
        code ? "#{loc.name} (#{code})" : loc.name
      end

      def destination_warehouse_id
        warehouse_at_destination&.id
      end

      def destination_warehouse_name
        warehouse_at_destination&.name
      end

      def unit_name
        object.unit&.abbreviation.presence || object.unit&.name
      end

      def base_unit_name
        object.base_unit&.name
      end

      private

      def warehouse_at_destination
        return @warehouse_at_destination if defined?(@warehouse_at_destination)

        @warehouse_at_destination = Warehouse.find_by(location_id: object.destination_location_id)
      end
    end
  end
end
