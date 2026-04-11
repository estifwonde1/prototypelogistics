module Cats
  module Warehouse
    class ReferenceDataController < BaseController
      def facility_options
        authorize :reference_data, :facility_options?, policy_class: ReferenceDataPolicy
        render_success(FacilityReferenceData.as_json)
      end

      def create_commodity
        authorize :reference_data, :create_commodity?, policy_class: ReferenceDataPolicy

        payload = params.require(:commodity).permit(:name, :code, :batch_no, :unit_id, :commodity_category_id)

        attrs = payload.to_h.slice("name", "code", "batch_no")
        attrs["unit_of_measure_id"] = payload[:unit_id] if payload[:unit_id].present?
        attrs["commodity_category_id"] = payload[:commodity_category_id] if payload[:commodity_category_id].present?

        commodity = Cats::Core::Commodity.create!(attrs)

        render_success({
          id: commodity.id,
          name: commodity.name,
          code: commodity.code,
          batch_no: commodity.batch_no,
          unit_id: commodity.unit_of_measure_id,
          unit_name: commodity.unit_of_measure&.name
        })
      end

      def commodities
        authorize :reference_data, :commodities?, policy_class: ReferenceDataPolicy

        commodities = Cats::Core::Commodity
          .includes(:unit_of_measure)
          .order(:name, :batch_no, :id)
          .map do |commodity|
            commodity_name = commodity[:name].presence || commodity[:batch_no].presence || commodity[:code].presence

            {
              id: commodity.id,
              name: commodity_name || "Commodity ##{commodity.id}",
              code: commodity[:code],
              batch_no: commodity[:batch_no],
              unit_id: commodity.unit_of_measure_id,
              unit_name: commodity.unit_of_measure&.name,
              unit_abbreviation: commodity.unit_of_measure&.abbreviation
            }
          end

        render_success(commodities: commodities)
      end

      def units
        authorize :reference_data, :units?, policy_class: ReferenceDataPolicy

        units = Cats::Core::UnitOfMeasure
          .order(:name, :id)
          .map do |unit|
            {
              id: unit.id,
              name: unit.name,
              abbreviation: unit.abbreviation,
              unit_type: unit.unit_type
            }
          end

        render_success(units: units)
      end

      def transporters
        authorize :reference_data, :transporters?, policy_class: ReferenceDataPolicy

        transporters = Cats::Core::Transporter
          .order(:name, :code, :id)
          .map do |t|
            {
              id: t.id,
              code: t.code,
              name: t.name,
              address: t.address,
              contact_phone: t.contact_phone
            }
          end

        render_success(transporters: transporters)
      end

      def lots
        authorize :reference_data, :inventory_lots?, policy_class: ReferenceDataPolicy

        lots = inventory_lot_payload
        render_success(lots: lots)
      end

      def inventory_lots
        authorize :reference_data, :inventory_lots?, policy_class: ReferenceDataPolicy

        lots = inventory_lot_payload
        render_success(inventory_lots: lots)
      end

      def uom_conversions
        authorize :reference_data, :uom_conversions?, policy_class: ReferenceDataPolicy

        conversions = UomConversion
          .active_only
          .includes(:from_unit, :to_unit)
          .map do |c|
            {
              id: c.id,
              commodity_id: c.commodity_id,
              from_unit_id: c.from_unit_id,
              from_unit_name: c.from_unit&.name,
              to_unit_id: c.to_unit_id,
              to_unit_name: c.to_unit&.name,
              multiplier: c.multiplier.to_f,
              active: c.active,
              conversion_type: c.conversion_type
            }
          end

        render_success(uom_conversions: conversions)
      end

      private

      def inventory_lot_payload
        InventoryLot
          .includes(:warehouse)
          .order(created_at: :desc)
          .map do |lot|
            {
              id: lot.id,
              warehouse_id: lot.warehouse_id,
              warehouse_name: lot.warehouse&.name,
              commodity_id: lot.commodity_id,
              lot_code: lot.lot_code,
              batch_no: lot.batch_no,
              expiry_date: lot.expiry_date,
              received_on: lot.received_on,
              status: lot.status,
              display_name: lot.display_name
            }
          end
      end
    end
  end
end
