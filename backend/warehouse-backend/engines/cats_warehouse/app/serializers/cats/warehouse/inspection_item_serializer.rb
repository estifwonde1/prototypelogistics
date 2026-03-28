module Cats
  module Warehouse
    class InspectionItemSerializer < ApplicationSerializer
      attributes :id, :inspection_id, :commodity_id, :commodity_name, :commodity_code, :quantity_received,
                 :quantity_damaged, :quantity_lost, :quality_status, :packaging_condition, :remarks,
                 :created_at, :updated_at

      def commodity_name
        object.commodity&.[](:name) || object.commodity&.batch_no
      end

      def commodity_code
        object.commodity&.[](:code)
      end
    end
  end
end
