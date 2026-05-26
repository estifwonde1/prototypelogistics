# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name,
                 :base_quantity, :base_unit_id, :base_unit_name,
                 :packaging_unit_id, :packaging_size, :package_count, :remarks

      has_many :source_allocations, serializer: DispatchLineSourceAllocationSerializer
      has_many :destination_allocations, serializer: DispatchLineDestinationAllocationSerializer

      def commodity_name
        object.commodity&.name
      end

      def unit_name
        object.unit&.abbreviation || object.unit&.name
      end

      def base_unit_name
        object.base_unit&.abbreviation || object.base_unit&.name
      end
    end
  end
end
