module Cats
  module Warehouse
    class StockBalanceSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :store_id, :stack_id, :commodity_id, :quantity, :unit_id, :created_at, :updated_at,
                 :warehouse_name, :warehouse_code, :store_name, :store_code, :stack_code,
                 :commodity_name, :commodity_batch_no, :unit_name, :unit_abbreviation

      def warehouse_name
        object.warehouse&.name
      end

      def warehouse_code
        object.warehouse&.code
      end

      def store_name
        object.store&.name
      end

      def store_code
        object.store&.code
      end

      def stack_code
        object.stack&.code
      end

      def commodity_name
        object.commodity&.[](:name) || object.commodity&.description || object.commodity&.batch_no
      end

      def commodity_batch_no
        object.commodity&.batch_no
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
