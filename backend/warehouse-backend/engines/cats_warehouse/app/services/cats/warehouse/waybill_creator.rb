module Cats
  module Warehouse
    class WaybillCreator
      def initialize(reference_no:, issued_on:, source_location:, destination_location:, items:, transport:, dispatch: nil, status: nil, dispatch_order: nil, prepared_by: nil)
        @reference_no = reference_no
        @issued_on = issued_on
        @source_location = source_location
        @destination_location = destination_location
        @items = items
        @transport = transport
        @dispatch = dispatch
        @status = status
        @dispatch_order = dispatch_order
        @prepared_by = prepared_by
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?
        raise ArgumentError, "transport is required" if @transport.nil?

        Waybill.transaction do
          waybill = Waybill.create!(
            reference_no: @reference_no,
            issued_on: @issued_on,
            source_location_id: fetch_id(@source_location),
            destination_location_id: fetch_id(@destination_location),
            dispatch: @dispatch,
            status: @status,
            dispatch_order: @dispatch_order,
            prepared_by: @prepared_by,
            workflow_status: @dispatch_order.present? ? "prepared" : @status
          )

          WaybillTransport.create!(
            waybill: waybill,
            transporter_id: fetch_id_from(@transport, :transporter),
            vehicle_plate_no: @transport[:vehicle_plate_no],
            driver_name: @transport[:driver_name],
            driver_phone: @transport[:driver_phone]
          )

          @items.each do |item|
            raise ArgumentError, "quantity must be positive" unless item[:quantity].to_f.positive?

            unit_id = fetch_id_from(item, :unit)
            entered_unit_id = fetch_id_from_optional(item, :entered_unit) || unit_id
            base_unit_id = fetch_id_from_optional(item, :base_unit)
            base_quantity = item[:base_quantity]

            waybill.waybill_items.create!(
              commodity_id: fetch_id_from(item, :commodity),
              quantity: item[:quantity],
              unit_id: unit_id,
              inventory_lot_id: item[:inventory_lot_id] || item[:inventory_lot]&.id,
              entered_unit_id: entered_unit_id,
              base_unit_id: base_unit_id,
              base_quantity: base_quantity
            )
          end

          WaybillPreparationService.new(waybill: waybill, actor: @prepared_by).call if @dispatch_order.present? && @prepared_by.present?
          waybill
        end
      end

      private

      def fetch_id(value)
        return value.id if value.respond_to?(:id)
        return value if value.present?

        raise ArgumentError, "location is required"
      end

      def fetch_id_from(hash, key)
        value = hash[key] || hash[:"#{key}_id"]
        return value&.id if value.respond_to?(:id)
        return value if value.present?

        raise ArgumentError, "#{key} is required"
      end

      def fetch_id_from_optional(hash, key)
        value = hash[key] || hash[:"#{key}_id"]
        return value&.id if value.respond_to?(:id)
        return value if value.present?

        nil
      end
    end
  end
end
