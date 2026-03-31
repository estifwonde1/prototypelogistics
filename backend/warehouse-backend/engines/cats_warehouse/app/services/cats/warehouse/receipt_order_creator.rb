module Cats
  module Warehouse
    class ReceiptOrderCreator
      def initialize(hub:, warehouse:, received_date:, created_by:, items:, source: nil, reference_no: nil, description: nil)
        @hub = hub
        @warehouse = warehouse
        @received_date = received_date
        @created_by = created_by
        @items = items
        @source = source
        @reference_no = reference_no
        @description = description
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        ReceiptOrder.transaction do
          order = ReceiptOrder.create!(
            hub: @hub,
            warehouse: @warehouse,
            received_date: @received_date,
            created_by: @created_by,
            source: @source,
            reference_no: @reference_no || generate_reference_no,
            description: @description,
            status: "Draft"
          )

          @items.each do |item|
            order.receipt_order_lines.create!(
              commodity_id: item[:commodity_id],
              quantity: item[:quantity],
              unit_id: item[:unit_id]
            )
          end

          order
        end
      end

      private

      def generate_reference_no
        "RO-#{SecureRandom.hex(4).upcase}"
      end
    end
  end
end
