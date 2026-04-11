module Cats
  module Warehouse
    class InspectionItemSerializer < ApplicationSerializer
      attributes :id, :inspection_id, :commodity_id, :commodity_name, :commodity_code,
                 :inventory_lot_id, :line_reference_no, :batch_no, :expiry_date, :entered_unit_id, :entered_unit_name,
                 :base_unit_id, :base_unit_name, :base_quantity, :quantity_received, :quantity_damaged, :quantity_lost,
                 :quality_status, :packaging_condition, :remarks, :created_at, :updated_at

      def commodity_name
        object.commodity&.[](:name) || object.commodity&.batch_no
      end

      def commodity_code
        object.commodity&.[](:code)
      end

      def unit_name
        object.unit&.name
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
