module Cats
  module Warehouse
    class ReceiptOrderCreator
      def initialize(explicit_hub: nil, warehouse: nil, received_date: nil, created_by:, items: nil, source: nil, reference_no: nil, description: nil, name: nil)
        @explicit_hub = explicit_hub
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
          resolved_hub = ReceiptOrderHubResolver.call(explicit_hub: @explicit_hub, warehouse: @warehouse)
          order = ReceiptOrder.create!(
            hub: resolved_hub,
            warehouse: @warehouse,
            received_date: @received_date,
            created_by: @created_by,
            source: @source,
            reference_no: @reference_no.presence,
            name: @name,
            description: @description,
            status: ContractConstants::DOCUMENT_STATUSES[:draft]
          )

          @items.each do |raw|
            order.receipt_order_lines.create!(ReceiptOrderLine.attributes_from_line_payload(raw))
          end

          order
        end
      end

      private
    end
  end
end
