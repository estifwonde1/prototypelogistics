module Cats
  module Warehouse
    class DispatchOrderCreator
      def initialize(hub: nil, warehouse: nil, dispatched_date: nil, created_by:, items: nil, destination: nil, reference_no: nil, description: nil, name: nil, location_id: nil, hierarchical_level: nil, fdp: nil, response_plan_ref: nil, approval_date: nil, response_type: nil)
        @hub = hub
        @warehouse = warehouse
        @dispatched_date = dispatched_date
        @created_by = created_by
        @items = items || []
        @destination = destination
        @reference_no = reference_no
        @description = description
        @name = name
        @location_id = location_id
        @hierarchical_level = hierarchical_level
        @fdp = fdp
        @response_plan_ref = response_plan_ref
        @approval_date = approval_date
        @response_type = response_type
      end

      def call
        DispatchOrder.transaction do
          first_item = @items.first
          order_warehouse = @warehouse || find_optional_warehouse(first_item&.dig(:warehouse_id))
          order_hub = @hub || find_optional_hub(first_item&.dig(:hub_id)) || order_warehouse&.hub
          order_fdp = @fdp || find_optional_fdp(first_item&.dig(:fdp_id))
          order_dispatched_date = @dispatched_date || parse_line_receive_date(first_item)

          order = DispatchOrder.create!(
            hub: order_hub,
            warehouse: order_warehouse,
            dispatched_date: order_dispatched_date,
            created_by: @created_by,
            destination: @destination,
            reference_no: @reference_no.presence,
            name: @name.presence || order_fdp&.name,
            description: @description,
            status: ContractConstants::DOCUMENT_STATUSES[:draft],
            location_id: @location_id,
            hierarchical_level: @hierarchical_level,
            fdp: order_fdp,
            response_plan_ref: @response_plan_ref,
            approval_date: @approval_date,
            response_type: @response_type
          )

          @items.each do |item|
            line_warehouse = find_optional_warehouse(item[:warehouse_id]) || order_warehouse
            line_hub = find_optional_hub(item[:hub_id]) || line_warehouse&.hub

            order.dispatch_order_lines.create!(
              commodity_id: item[:commodity_id],
              quantity: item[:quantity],
              unit_id: item[:unit_id],
              warehouse_id: line_warehouse&.id,
              hub_id: line_hub&.id,
              fdp_id: item[:fdp_id].presence || order_fdp&.id,
              expected_receive_at: item[:expected_receive_at]
            )
          end

          order
        end
      end

      private

      def find_optional_hub(id)
        id.present? ? Hub.find_by(id: id) : nil
      end

      def find_optional_warehouse(id)
        id.present? ? Warehouse.find_by(id: id) : nil
      end

      def find_optional_fdp(id)
        id.present? ? Fdp.find_by(id: id) : nil
      end

      def parse_line_receive_date(item)
        return Date.today unless item

        raw = item[:expected_receive_at]
        return Date.today if raw.blank?

        Time.zone.parse(raw.to_s).to_date
      rescue ArgumentError, TypeError
        Date.today
      end
    end
  end
end
