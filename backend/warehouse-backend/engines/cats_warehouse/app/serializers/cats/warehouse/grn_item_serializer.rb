module Cats
  module Warehouse
    class GrnItemSerializer < ApplicationSerializer
      attributes :id, :grn_id, :commodity_id, :commodity_name, :commodity_code, :quantity, :unit_id, :unit_name,
                 :unit_abbreviation, :inventory_lot_id, :line_reference_no, :batch_no, :expiry_date,
                 :entered_unit_id, :entered_unit_name, :base_unit_id, :base_unit_name, :base_quantity, :quality_status,
                 :store_id, :store_name, :store_code, :stack_id, :stack_name, :stack_code, :created_at, :updated_at

      def commodity_name
        object.commodity&.[](:name) || object.commodity&.batch_no
      end

      def commodity_code
        object.commodity&.[](:code)
      end

      def unit_name
        object.unit&.name
      end

      def unit_abbreviation
        object.unit&.abbreviation
      end

      def store_name
        object.store&.name
      end

      def store_code
        object.store&.code
      end

      def stack_name
        object.stack&.code
      end

      def stack_code
        object.stack&.code
      end

      def batch_no
        object.inventory_lot&.batch_no.presence || object.line_reference_no
      end

      def expiry_date
        object.inventory_lot&.expiry_date
      end

      def entered_unit_name
        object.entered_unit&.name
      end

      def base_unit_name
        object.base_unit&.name
      end
    end
  end
end
