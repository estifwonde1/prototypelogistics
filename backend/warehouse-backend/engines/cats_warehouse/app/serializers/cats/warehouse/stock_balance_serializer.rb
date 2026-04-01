module Cats
  module Warehouse
    class StockBalanceSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :store_id, :stack_id, :commodity_id, :quantity, :unit_id,
                 :inventory_lot_id, :batch_no, :expiry_date, :entered_unit_id, :entered_unit_name,
                 :base_unit_id, :base_unit_name, :base_quantity, :reserved_quantity, :available_quantity, :created_at, :updated_at,
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

      def batch_no
        object.inventory_lot&.batch_no
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
