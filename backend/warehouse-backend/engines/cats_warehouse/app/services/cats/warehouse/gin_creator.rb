module Cats
  module Warehouse
    class GinCreator
      def initialize(warehouse:, issued_on:, issued_by:, items:, destination: nil, reference_no: nil, status: "Draft")
        @warehouse = warehouse
        @issued_on = issued_on
        @issued_by = issued_by
        @items = items
        @destination = destination
        @reference_no = reference_no
        @status = status
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        Gin.transaction do
          gin = Gin.create!(
            warehouse: @warehouse,
            issued_on: @issued_on,
            issued_by: @issued_by,
            destination: @destination,
            reference_no: @reference_no,
            status: @status
          )

          @items.each do |item|
            raise ArgumentError, "quantity must be positive" unless item[:quantity].to_f.positive?

            gin.gin_items.create!(
              commodity_id: fetch_id(item, :commodity),
              quantity: item[:quantity],
              unit_id: fetch_id(item, :unit),
              store_id: fetch_id(item, :store, optional: true),
              stack_id: fetch_id(item, :stack, optional: true)
            )
          end

          gin
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
