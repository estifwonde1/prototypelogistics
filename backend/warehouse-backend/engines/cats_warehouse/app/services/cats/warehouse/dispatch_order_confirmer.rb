module Cats
  module Warehouse
    class DispatchOrderConfirmer
      def initialize(order:, confirmed_by: nil)
        @order = order
        @confirmed_by = confirmed_by
      end

      def call
        @order.ensure_confirmable!

        DispatchOrder.transaction do
          @order.reference_no = generated_reference_no if @order.reference_no.blank?
          old_status = @order.status
          @order.update!(
            status: ContractConstants::DOCUMENT_STATUSES[:confirmed],
            confirmed_by: @confirmed_by || @order.confirmed_by,
            confirmed_at: Time.current
          )
          WorkflowEventRecorder.record!(
            entity: @order,
            event_type: "dispatch_order.confirmed",
            actor: @confirmed_by,
            from_status: old_status,
            to_status: @order.status
          )

          auto_assign_source_facilities!
          commit_stock_availability_changes!

          enqueue_notification("dispatch_order.confirmed", dispatch_order_id: @order.id)

          @order
        end
      end

      private

      def commit_stock_availability_changes!
        @order.dispatch_order_lines.each do |line|
          warehouse = Warehouse.find_by(id: line.warehouse_id)
          next if warehouse.blank?

          # Only process existing stock balances (i.e., stock that has been received via GRN)
          # If no stock exists yet, we skip the reservation and allow the dispatch to be confirmed
          # Stock will be reserved once it actually arrives in the warehouse
          balance = StockBalance.find_by(
            warehouse_id: warehouse.id,
            store_id: nil,
            stack_id: nil,
            commodity_id: line.commodity_id,
            unit_id: line.unit_id,
            inventory_lot_id: nil
          )

          next if balance.blank? || balance.quantity.to_f <= 0

          # Only update if we have existing stock to reserve
          new_reserved = balance.reserved_quantity.to_f + line.quantity.to_f
          available = balance.quantity.to_f - new_reserved

          # Prevent over-commit (negative available)
          if available < -0.0001
            raise Cats::Warehouse::InsufficientSpaceError,
                  "Cannot confirm dispatch order: reservation exceeds available stock for #{line.commodity&.name || 'commodity'}"
          end

          balance.reserved_quantity = new_reserved
          balance.available_quantity = available
          balance.save!
        end
      end

      def generated_reference_no
        "DO-#{SecureRandom.hex(4).upcase}"
      end

      def auto_assign_source_facilities!
        @order.dispatch_order_lines.each do |line|
          warehouse = Warehouse.find_by(id: line.warehouse_id)
          next if warehouse.blank?

          hub = Hub.find_by(id: line.hub_id) || warehouse.hub
          assignment_attrs = build_assignment_attrs(warehouse: warehouse, hub: hub)
          next if assignment_attrs.blank?

          assignment = DispatchOrderAssignment.find_or_initialize_by(
            dispatch_order: @order,
            dispatch_order_line: line,
            hub_id: assignment_attrs[:hub_id],
            warehouse_id: assignment_attrs[:warehouse_id],
            store_id: nil
          )

          assignment.assigned_by = @confirmed_by || @order.confirmed_by || @order.created_by
          assignment.assigned_to_id = assignment_attrs[:assigned_to_id]
          assignment.quantity = line.quantity
          # Hub-level assignments stay pending until hub manager delegates to a warehouse.
          assignment.status = if assignment_attrs[:warehouse_id].present?
                                ContractConstants::DOCUMENT_STATUSES[:assigned]
                              else
                                "pending"
                              end

          was_new = assignment.new_record?
          assignment.save! if assignment.new_record? || assignment.changed?

          next unless was_new

          WorkflowEventRecorder.record!(
            entity: @order,
            event_type: "dispatch_order.source_auto_assigned",
            actor: @confirmed_by,
            from_status: @order.status,
            to_status: @order.status,
            payload: {
              line_id: line.id,
              assigned_to_id: assignment.assigned_to_id,
              hub_id: assignment.hub_id,
              warehouse_id: assignment.warehouse_id,
              quantity: assignment.quantity
            }
          )
        end
      end

      def build_assignment_attrs(warehouse:, hub:)
        if hub.present? && warehouse.hub_id.present?
          manager = facility_manager_user(role_name: "Hub Manager", hub_id: hub.id)
          return nil if manager.blank?

          {
            assigned_to_id: manager.id,
            hub_id: hub.id,
            warehouse_id: nil
          }
        else
          manager = facility_manager_user(role_name: "Warehouse Manager", warehouse_id: warehouse.id)
          return nil if manager.blank?

          {
            assigned_to_id: manager.id,
            hub_id: nil,
            warehouse_id: warehouse.id
          }
        end
      end

      def facility_manager_user(role_name:, hub_id: nil, warehouse_id: nil)
        UserAssignment.includes(:user)
                      .where(role_name: role_name, hub_id: hub_id, warehouse_id: warehouse_id)
                      .order(:id)
                      .map(&:user)
                      .find { |user| user&.active? }
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
