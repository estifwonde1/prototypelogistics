# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationWaybillGenerator
      def initialize(authorization:, actor:)
        @authorization = authorization
        @actor = actor
        @order = authorization.dispatch_order
        @warehouse = authorization.warehouse
      end

      def call
        dest_location = primary_destination_location
        raise ArgumentError, "No destination location found for waybill" if dest_location.blank?

        items = build_waybill_items
        raise ArgumentError, "No waybill items" if items.empty?

        WaybillCreator.new(
          reference_no: "WB-#{@warehouse.code}-#{Time.current.strftime('%Y%m%d')}-#{@authorization.id}",
          issued_on: Date.current,
          source_location: @warehouse.location || Cats::Core::Location.find(@warehouse.location_id),
          destination_location: dest_location,
          items: items,
          transport: {
            transporter: @authorization.transporter,
            vehicle_plate_no: @authorization.truck_plate_number,
            driver_name: @authorization.driver_name,
            driver_phone: resolve_driver_phone
          },
          dispatch_order: @order,
          prepared_by: @actor,
          status: ContractConstants::DOCUMENT_STATUSES[:draft]
        ).call.tap do |waybill|
          waybill.update!(dispatch_order_authorization: @authorization)
        end
      end

      private

      def resolve_driver_phone
        phone = @authorization.driver_phone.presence || transport_record_phone
        raise ArgumentError, "Driver phone is required" if phone.blank?

        phone
      end

      def transport_record_phone
        TransportRecord.find_by(dispatch_order_id: @order.id, warehouse_id: @warehouse.id)&.phone
      end

      def primary_destination_location
        DispatchLineDestinationAllocation
          .joins(:dispatch_order_line)
          .where(cats_warehouse_dispatch_order_lines: { dispatch_order_id: @order.id })
          .first
          &.destination_location
      end

      def build_waybill_items
        commodity_rows = @authorization.dispatch_order_authorization_stores.group_by(&:commodity_id)
        commodity_rows.map do |commodity_id, stores|
          qty = stores.sum { |s| s.authorized_quantity.to_f }
          commodity = Cats::Core::Commodity.find(commodity_id)
          unit_id = @authorization.authorized_quantity_input_unit_id || commodity.unit_of_measure_id
          base_unit_id = commodity.unit_of_measure_id
          base_qty = UomConversionResolver.convert!(qty, from_unit_id: unit_id, to_unit_id: base_unit_id, commodity_id: commodity_id)

          {
            commodity: commodity,
            quantity: qty,
            unit: Cats::Core::UnitOfMeasure.find(unit_id),
            base_unit_id: base_unit_id,
            base_quantity: base_qty
          }
        end
      end
    end
  end
end
