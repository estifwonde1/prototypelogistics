module Cats
  module Warehouse
    class DispatchOrderCreator
      def initialize(hub:, warehouse:, dispatched_date:, created_by:, items:, destination: nil, reference_no: nil, description: nil)
        @hub = hub
        @warehouse = warehouse
        @dispatched_date = dispatched_date
        @created_by = created_by
        @items = items
        @destination = destination
        @reference_no = reference_no
        @description = description
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        DispatchOrder.transaction do
          order = DispatchOrder.create!(
            hub: @hub,
            warehouse: @warehouse,
            dispatched_date: @dispatched_date,
            created_by: @created_by,
            destination: @destination,
            reference_no: @reference_no || generate_reference_no,
            description: @description,
            status: "Draft"
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

      def generate_reference_no
        "DO-#{SecureRandom.hex(4).upcase}"
      end
    end
  end
end
