module Cats
  module Warehouse
    class ReceiptOrderCreator
      def initialize(hub: nil, warehouse: nil, received_date: nil, created_by:, items: nil, source: nil, reference_no: nil, description: nil, name: nil)
        @hub = hub
        @warehouse = warehouse
        @received_date = received_date
        @created_by = created_by
        @items = items || []
        @source = source
        @reference_no = reference_no
        @description = description
        @name = name
      end

      def call
        ReceiptOrder.transaction do
          order = ReceiptOrder.create!(
            hub: @hub,
            warehouse: @warehouse,
            received_date: @received_date,
            created_by: @created_by,
            source: @source,
            reference_no: @reference_no.presence,
            name: @name,
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
    end
  end
end
