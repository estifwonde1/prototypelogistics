module Cats
  module Warehouse
    class WaybillItemSerializer < ApplicationSerializer
      attributes :id, :waybill_id, :commodity_id, :commodity_name, :commodity_code, :quantity, :unit_id,
                 :unit_name, :unit_abbreviation, :created_at, :updated_at

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
    end
  end
end
