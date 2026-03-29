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
    end
  end
end
