module Cats
  module Warehouse
    class StockReservationService
      def initialize(order:, actor:, reservations:)
        @order = order
        @actor = actor
        @reservations = Array(reservations)
      end

      def call
        raise ArgumentError, "reservations are required" if @reservations.empty?

        DispatchOrder.transaction do
          @reservations.each do |payload|
            line = @order.dispatch_order_lines.find(payload[:dispatch_order_line_id])
            warehouse = payload[:warehouse_id].present? ? Warehouse.find(payload[:warehouse_id]) : @order.warehouse
            store = payload[:store_id].present? ? Store.find(payload[:store_id]) : nil
            stack = payload[:stack_id].present? ? Stack.find(payload[:stack_id]) : nil
            inventory_lot_id = payload[:inventory_lot_id]

            reserve_against_balance!(
              warehouse: warehouse,
              store: store,
              stack: stack,
              commodity_id: payload[:commodity_id] || line.commodity_id,
              unit_id: payload[:unit_id] || line.unit_id,
              inventory_lot_id: inventory_lot_id,
              reserved_quantity: payload[:reserved_quantity]
            )

            StockReservation.create!(
              dispatch_order: @order,
              dispatch_order_line: line,
              warehouse: warehouse,
              store: store,
              stack: stack,
              commodity_id: payload[:commodity_id] || line.commodity_id,
              unit_id: payload[:unit_id] || line.unit_id,
              inventory_lot_id: inventory_lot_id,
              reserved_quantity: payload[:reserved_quantity],
              issued_quantity: payload[:issued_quantity] || 0,
              status: payload[:status].presence || "Reserved",
              reserved_by: @actor
            )
          end

          transition_order!("Reserved", "dispatch_order.stock_reserved", reservations_count: @reservations.size)
          @order
        end
      end

      private

      def reserve_against_balance!(warehouse:, store:, stack:, commodity_id:, unit_id:, inventory_lot_id:, reserved_quantity:)
        balance = StockBalance.find_by!(
          warehouse_id: warehouse.id,
          store_id: store&.id,
          stack_id: stack&.id,
          commodity_id: commodity_id,
          unit_id: unit_id,
          inventory_lot_id: inventory_lot_id
        )

        balance.reserved_quantity = balance.reserved_quantity.to_f + reserved_quantity.to_f
        balance.available_quantity = balance.quantity.to_f - balance.reserved_quantity.to_f

        raise ArgumentError, "reservation exceeds available stock" if balance.available_quantity.to_f < -0.0001

        balance.save!
      end

      def transition_order!(new_status, event_type, payload)
        old_status = @order.status
        @order.update!(status: new_status)
        WorkflowEventRecorder.record!(entity: @order, event_type: event_type, actor: @actor, from_status: old_status, to_status: new_status, payload: payload)
      end
    end
  end
end
