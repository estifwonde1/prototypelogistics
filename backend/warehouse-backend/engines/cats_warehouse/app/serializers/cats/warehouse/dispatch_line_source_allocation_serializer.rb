# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchLineSourceAllocationSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :quantity, :unit_id, :base_quantity, :base_unit_id,
                 :warehouse_ownership_type, :unit_name, :base_unit_name, :warehouse_label

      belongs_to :warehouse, serializer: LookupOptionSerializer

      def warehouse_label
        wh = object.warehouse
        return unless wh

        code = wh.code.presence
        code ? "#{wh.name} (#{code})" : wh.name
      end

      def unit_name
        object.unit&.abbreviation.presence || object.unit&.name
      end

      def base_unit_name
        object.base_unit&.name
      end
    end
  end
end
