module Cats
  module Warehouse
    class StackTransactionSerializer < ApplicationSerializer
      attributes :id, :source_id, :destination_id, :transaction_date, :quantity, :unit_id, :status,
                 :inventory_lot_id, :batch_no, :expiry_date, :entered_unit_id, :entered_unit_name,
                 :base_unit_id, :base_unit_name, :base_quantity,
                 :reference_type, :reference_id, :created_at, :updated_at, :source_stack_code,
                 :destination_stack_code, :source_store_id, :destination_store_id, :source_store_name,
                 :destination_store_name, :source_warehouse_id, :destination_warehouse_id,
                 :source_warehouse_name, :destination_warehouse_name, :commodity_id, :commodity_name,
                 :unit_name, :unit_abbreviation, :reference_no, :reference_status, :movement_type

      def source_stack_code
        object.source&.code
      end

      def destination_stack_code
        object.destination&.code
      end

      def source_store_id
        object.source&.store_id
      end

      def destination_store_id
        object.destination&.store_id
      end

      def source_store_name
        object.source&.store&.name
      end

      def destination_store_name
        object.destination&.store&.name
      end

      def source_warehouse_id
        object.source&.store&.warehouse_id
      end

      def destination_warehouse_id
        object.destination&.store&.warehouse_id
      end

      def source_warehouse_name
        object.source&.store&.warehouse&.name
      end

      def destination_warehouse_name
        object.destination&.store&.warehouse&.name
      end

      def commodity_id
        reference_item&.commodity_id
      end

      def commodity_name
        reference_item&.commodity&.[](:name) || reference_item&.commodity&.description || reference_item&.commodity&.batch_no
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

      def reference_no
        object.reference&.respond_to?(:reference_no) ? object.reference.reference_no : nil
      end

      def reference_status
        object.reference&.respond_to?(:status) ? object.reference.status.to_s.titleize : nil
      end

      def movement_type
        if object.source_id.present? && object.destination_id.blank?
          "outbound"
        elsif object.destination_id.present? && object.source_id.blank?
          "inbound"
        else
          "adjustment"
        end
      end

      private

      def reference_item
        @reference_item ||= begin
          case object.reference
          when Cats::Warehouse::Grn
            object.reference.grn_items.find_by(stack_id: object.destination_id, unit_id: object.unit_id) ||
              object.reference.grn_items.find_by(unit_id: object.unit_id)
          when Cats::Warehouse::Gin
            object.reference.gin_items.find_by(stack_id: object.source_id, unit_id: object.unit_id) ||
              object.reference.gin_items.find_by(unit_id: object.unit_id)
          when Cats::Warehouse::Inspection
            object.reference.inspection_items.find_by(commodity_id: object.destination&.commodity_id || object.source&.commodity_id)
          end
        end
      end
    end
  end
end
