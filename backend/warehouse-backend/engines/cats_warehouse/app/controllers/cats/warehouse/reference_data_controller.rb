module Cats
  module Warehouse
    class ReferenceDataController < BaseController
      def facility_options
        authorize :reference_data, :facility_options?, policy_class: ReferenceDataPolicy
        render_success(FacilityReferenceData.as_json)
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

      def inventory_lots
        authorize :reference_data, :inventory_lots?, policy_class: ReferenceDataPolicy

        lots = InventoryLot
          .order(created_at: :desc)
          .map do |lot|
            {
              id: lot.id,
              commodity_id: lot.commodity_id,
              batch_no: lot.batch_no,
              expiry_date: lot.expiry_date,
              display_name: lot.display_name
            }
          end

        render_success(inventory_lots: lots)
      end

      def uom_conversions
        authorize :reference_data, :uom_conversions?, policy_class: ReferenceDataPolicy

        conversions = UomConversion
          .includes(:from_unit, :to_unit)
          .map do |c|
            {
              id: c.id,
              commodity_id: c.commodity_id,
              from_unit_id: c.from_unit_id,
              from_unit_name: c.from_unit&.name,
              to_unit_id: c.to_unit_id,
              to_unit_name: c.to_unit&.name,
              multiplier: c.multiplier.to_f
            }
          end

        render_success(uom_conversions: conversions)
      end
    end
  end
end
