module Cats
  module Warehouse
    class InspectionCreator
      def initialize(warehouse:, inspected_on:, inspector:, items:, source: nil, reference_no: nil, status: "Draft")
        @warehouse = warehouse
        @inspected_on = inspected_on
        @inspector = inspector
        @items = items
        @source = source
        @reference_no = reference_no
        @status = status
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        Inspection.transaction do
          inspection = Inspection.create!(
            warehouse: @warehouse,
            inspected_on: @inspected_on,
            inspector: @inspector,
            source: @source,
            reference_no: @reference_no,
            status: @status
          )

          @items.each do |item|
            raise ArgumentError, "quantity_received must be positive" unless item[:quantity_received].to_f.positive?

            inspection.inspection_items.create!(
              commodity_id: fetch_id(item, :commodity),
              quantity_received: item[:quantity_received],
              quantity_damaged: item[:quantity_damaged] || 0,
              quantity_lost: item[:quantity_lost] || 0,
              quality_status: item[:quality_status],
              packaging_condition: item[:packaging_condition],
              remarks: item[:remarks]
            )
          end

          inspection
        end
      end

      private

      def fetch_id(item, key, optional: false)
        value = item[key] || item[:"#{key}_id"]
        return value&.id if value.respond_to?(:id)
        return value if value.present?
        return nil if optional

        raise ArgumentError, "#{key} is required"
      end
    end
  end
end
