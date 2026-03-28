module Cats
  module Warehouse
    class GinItemSerializer < ApplicationSerializer
      attributes :id, :gin_id, :commodity_id, :commodity_name, :commodity_code, :quantity, :unit_id, :unit_name,
                 :unit_abbreviation, :store_id, :store_name, :store_code, :stack_id, :stack_name, :stack_code,
                 :created_at, :updated_at

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
    end
  end
end
