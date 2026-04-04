module Cats
  module Warehouse
    class DispatchOrderCreator
      def initialize(hub: nil, warehouse: nil, dispatched_date: nil, created_by:, items: nil, destination: nil, reference_no: nil, description: nil, name: nil)
        @hub = hub
        @warehouse = warehouse
        @dispatched_date = dispatched_date
        @created_by = created_by
        @items = items || []
        @destination = destination
        @reference_no = reference_no
        @description = description
        @name = name
      end

      def call
        DispatchOrder.transaction do
          order = DispatchOrder.create!(
            hub: @hub,
            warehouse: @warehouse,
            dispatched_date: @dispatched_date,
            created_by: @created_by,
            destination: @destination,
            reference_no: @reference_no.presence,
            name: @name,
            description: @description,
            status: ContractConstants::DOCUMENT_STATUSES[:draft]
          )

          @items.each do |item|
            order.dispatch_order_lines.create!(
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
