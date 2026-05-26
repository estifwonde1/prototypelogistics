# frozen_string_literal: true

module Cats
  module Warehouse
    class GinPrintableService
      def self.call(gin:)
        new(gin: gin).call
      end

      def initialize(gin:)
        @gin = Gin.includes(:gin_items, :warehouse, :dispatch_order, :dispatch_order_authorization).find(gin.id)
      end

      def call
        auth = @gin.dispatch_order_authorization

        {
          reference_no: @gin.reference_no,
          issued_on: @gin.issued_on,
          status: @gin.status,
          warehouse_name: @gin.warehouse&.name,
          warehouse_code: @gin.warehouse&.code,
          dispatch_order_id: @gin.dispatch_order_id,
          dispatch_order_reference: @gin.dispatch_order&.reference_no,
          plan_reference: @gin.dispatch_order&.plan_reference,
          authorization_reference: auth&.reference_no,
          driver_name: auth&.driver_name,
          truck_plate_number: auth&.truck_plate_number,
          items: @gin.gin_items.map { |item| printable_item(item) }
        }
      end

      private

      def printable_item(item)
        {
          commodity_id: item.commodity_id,
          commodity_name: item.commodity&.name,
          quantity: item.quantity,
          unit_id: item.unit_id,
          stack_id: item.stack_id,
          store_id: item.store_id,
          base_quantity: item.base_quantity,
          commodity_grade: item.try(:commodity_grade)
        }
      end
    end
  end
end
