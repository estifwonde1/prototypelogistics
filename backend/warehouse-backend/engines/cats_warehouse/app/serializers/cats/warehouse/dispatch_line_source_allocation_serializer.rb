# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchLineSourceAllocationSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :quantity, :unit_id, :base_quantity, :base_unit_id,
                 :warehouse_ownership_type, :unit_name, :base_unit_name

      belongs_to :warehouse, serializer: LookupOptionSerializer

      def unit_name
        object.unit&.name
      end

      def base_unit_name
        object.base_unit&.name
      end
    end
  end
end
