module Cats
  module Warehouse
    class DispatchSerializer < ApplicationSerializer
      attributes :id,
                 :reference_no,
                 :dispatch_plan_item_id,
                 :transporter_id,
                 :plate_no,
                 :driver_name,
                 :driver_phone,
                 :commodity_name,
                 :commodity_code,
                 :quantity,
                 :unit_id,
                 :unit_name,
                 :unit_abbreviation,
                 :commodity_status,
                 :remark,
                 :prepared_by_id,
                 :dispatch_status,
                 :created_at,
                 :updated_at

      def commodity_name
        object.dispatch_plan_item&.commodity&.[](:name) || object.dispatch_plan_item&.commodity&.batch_no
      end

      def commodity_code
        object.dispatch_plan_item&.commodity&.[](:code)
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
