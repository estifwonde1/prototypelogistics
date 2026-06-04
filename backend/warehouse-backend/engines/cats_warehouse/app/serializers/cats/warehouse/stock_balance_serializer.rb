module Cats
  module Warehouse
    class StockBalanceSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :store_id, :stack_id, :commodity_id,
                 :quantity, :base_quantity, :unit_id, :inventory_lot_id,
                 :warehouse_name, :store_name, :stack_code,
                 :commodity_name, :commodity_batch_no, :unit_name, :unit_abbreviation,
                 :lot_batch_no, :lot_expiry_date

      def warehouse_name
        object.warehouse&.name
      end

      def store_name
        object.store&.name
      end

      def stack_code
        object.stack&.code
      end

      def commodity_name
        commodity = object.commodity
        return nil unless commodity
        commodity.read_attribute(:name).presence || commodity.batch_no
      end

      def commodity_batch_no
        object.commodity&.batch_no
      end

      def unit_name
        entered = object.entered_unit
        entered ? entered.name : object.unit&.name
      end

      def unit_abbreviation
        entered = object.entered_unit
        entered ? entered.abbreviation : object.unit&.abbreviation
      end

      def quantity
        if object.entered_unit_id.present? && object.entered_unit_id != object.unit_id
          UomConversionResolver.convert(
            object.quantity,
            from_unit_id: object.unit_id,
            to_unit_id: object.entered_unit_id,
            commodity_id: object.commodity_id
          )
        else
          object.quantity
        end
      end

      def lot_batch_no
        object.inventory_lot&.batch_no
      end

      def lot_expiry_date
        # Try inventory lot expiry first, then fall back to commodity best_use_before
        object.inventory_lot&.expiry_date ||
          object.commodity&.best_use_before
      end
    end
  end
end
