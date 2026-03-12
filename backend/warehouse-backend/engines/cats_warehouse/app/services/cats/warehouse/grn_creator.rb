module Cats
  module Warehouse
    class GrnCreator
      def initialize(warehouse:, received_on:, received_by:, items:, source: nil, reference_no: nil, status: "Draft")
        @warehouse = warehouse
        @received_on = received_on
        @received_by = received_by
        @items = items
        @source = source
        @reference_no = reference_no
        @status = status
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        Grn.transaction do
          grn = Grn.create!(
            warehouse: @warehouse,
            received_on: @received_on,
            received_by: @received_by,
            source: @source,
            reference_no: @reference_no,
            status: @status
          )

          @items.each do |item|
            raise ArgumentError, "quantity must be positive" unless item[:quantity].to_f.positive?

            grn.grn_items.create!(
              commodity_id: fetch_id(item, :commodity),
              quantity: item[:quantity],
              unit_id: fetch_id(item, :unit),
              quality_status: item[:quality_status],
              store_id: fetch_id(item, :store, optional: true),
              stack_id: fetch_id(item, :stack, optional: true)
            )
          end

          grn
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
