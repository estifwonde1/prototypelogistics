module Cats
  module Warehouse
    class ReceiptSerializer < ApplicationSerializer
      attributes :id,
                 :reference_no,
                 :receipt_authorization_id,
                 :commodity_id,
                 :commodity_name,
                 :commodity_status,
                 :commodity_grade,
                 :quantity,
                 :unit_id,
                 :unit_name,
                 :unit_abbreviation,
                 :remark,
                 :created_at,
                 :updated_at

      def commodity_id
        dispatch_plan_item&.commodity_id
      end

      def commodity_name
        dispatch_plan_item&.commodity&.[](:name) || dispatch_plan_item&.commodity&.batch_no
      end

      def unit_name
        object.unit&.name
      end

      def unit_abbreviation
        object.unit&.abbreviation
      end

      private

      def dispatch_plan_item
        object.receipt_authorization&.dispatch&.dispatch_plan_item
      end
    end
  end
end
