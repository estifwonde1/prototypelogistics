module Cats
  module Warehouse
    class ReceiptOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name

      def commodity_name
        object.commodity&.name
      end

      def unit_name
        object.unit&.abbreviation
      end
    end
  end
end
