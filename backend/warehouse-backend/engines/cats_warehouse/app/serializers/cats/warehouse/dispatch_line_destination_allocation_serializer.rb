# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchLineDestinationAllocationSerializer < ApplicationSerializer
      attributes :id, :destination_location_id, :destination_location_type,
                 :quantity, :unit_id, :base_quantity, :base_unit_id,
                 :unit_name, :base_unit_name, :destination_label

      belongs_to :destination_location, serializer: LookupOptionSerializer

      def destination_label
        loc = object.destination_location
        return unless loc

        code = loc.code.presence
        code ? "#{loc.name} (#{code})" : loc.name
      end

      def unit_name
        object.unit&.name
      end

      def base_unit_name
        object.base_unit&.name
      end
    end
  end
end
