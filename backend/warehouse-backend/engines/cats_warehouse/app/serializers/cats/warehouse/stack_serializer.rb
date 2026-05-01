module Cats
  module Warehouse
    class StackSerializer < ApplicationSerializer
      attributes :id, :code, :length, :width, :height, :start_x, :start_y, :commodity_id, :store_id,
                 :commodity_name, :commodity_code, :store_name, :store_code, :warehouse_id,
                 :commodity_status, :stack_status, :quantity, :unit_id, :unit_name, :unit_abbreviation,
                 :base_unit_id, :base_unit_name, :base_quantity, :reference,
                 :created_at, :updated_at

      def commodity_name
        object.commodity&.[](:name) || object.commodity&.batch_no
      end

      def commodity_code
        object.commodity&.[](:code)
      end

      def store_name
        object.store&.name
      end

      def store_code
        object.store&.code
      end

      def warehouse_id
        object.store&.warehouse_id
      end

      def unit_name
        object.unit&.name
      end

      def unit_abbreviation
        object.unit&.abbreviation
      end

      def base_unit_name
        object.base_unit&.name
      end
    end
  end
end
