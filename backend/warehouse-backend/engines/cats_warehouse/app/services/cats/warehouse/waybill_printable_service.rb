# frozen_string_literal: true

module Cats
  module Warehouse
    # Flat DTO for waybill document templates (DOCX/PDF); decoupled from API serializers.
    class WaybillPrintableService
      def self.call(waybill:)
        new(waybill: waybill).call
      end

      def initialize(waybill:)
        @waybill = Waybill.includes(:waybill_items, :waybill_transport, :dispatch_order, :dispatch_order_authorization).find(waybill.id)
      end

      def call
        transport = @waybill.waybill_transport
        auth = @waybill.dispatch_order_authorization

        {
          reference_no: @waybill.reference_no,
          issued_on: @waybill.issued_on,
          status: @waybill.status,
          source_location_name: @waybill.source_location&.name,
          destination_location_name: @waybill.destination_location&.name,
          dispatch_order_id: @waybill.dispatch_order_id,
          dispatch_order_reference: @waybill.dispatch_order&.reference_no,
          dispatch_reference: @waybill.dispatch_order&.dispatch_reference,
          authorization_reference: auth&.reference_no,
          transporter_name: transport&.transporter&.name || auth&.transporter_name,
          driver_name: transport&.driver_name || auth&.driver_name,
          vehicle_plate_no: transport&.vehicle_plate_no || auth&.truck_plate_number,
          items: @waybill.waybill_items.map { |item| printable_item(item) }
        }
      end

      private

      def printable_item(item)
        {
          commodity_id: item.commodity_id,
          commodity_name: safe_commodity_name(item.commodity),
          quantity: item.quantity,
          unit_id: item.unit_id,
          unit_name: item.unit&.abbreviation || item.unit&.name,
          base_quantity: item.base_quantity,
          base_unit_id: item.base_unit_id
        }
      end

      def safe_commodity_name(commodity)
        commodity&.name
      rescue NoMethodError
        commodity.try(:batch_no) || "Unknown"
      end
    end
  end
end
