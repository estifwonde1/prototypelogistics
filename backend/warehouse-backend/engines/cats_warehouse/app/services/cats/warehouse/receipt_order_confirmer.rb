module Cats
  module Warehouse
    class ReceiptOrderConfirmer
      def initialize(order:, confirmed_by: nil)
        @order = order
        @confirmed_by = confirmed_by
      end

      def call
        @order.ensure_confirmable!

        ReceiptOrder.transaction do
          @order.reference_no = generated_reference_no if @order.reference_no.blank?
          old_status = @order.status
          @order.update!(
            status: ContractConstants::DOCUMENT_STATUSES[:confirmed],
            confirmed_by: @confirmed_by || @order.confirmed_by,
            confirmed_at: Time.current
          )
          WorkflowEventRecorder.record!(entity: @order, event_type: "receipt_order.confirmed", actor: @confirmed_by, from_status: old_status, to_status: @order.status)
          auto_assign_facility_manager!

          enqueue_notification("receipt_order.confirmed", receipt_order_id: @order.id)

          @order
        end
      end

      private

      def generated_reference_no
        "RO-#{SecureRandom.hex(4).upcase}"
      end

      def auto_assign_facility_manager!
        assignment_attrs = auto_assignment_attrs
        return if assignment_attrs.blank?

        assignment = ReceiptOrderAssignment.find_or_initialize_by(
          receipt_order: @order,
          assigned_to_id: assignment_attrs[:assigned_to_id],
          hub_id: assignment_attrs[:hub_id],
          warehouse_id: assignment_attrs[:warehouse_id],
          store_id: nil
        )
        assignment.assigned_by = @confirmed_by || @order.confirmed_by || @order.created_by
        assignment.status = ContractConstants::DOCUMENT_STATUSES[:assigned]
        was_new = assignment.new_record?
        assignment.save! if assignment.new_record? || assignment.changed?

        WorkflowEventRecorder.record!(
          entity: @order,
          event_type: "receipt_order.manager_auto_assigned",
          actor: @confirmed_by,
          from_status: @order.status,
          to_status: @order.status,
          payload: {
            assigned_to_id: assignment.assigned_to_id,
            hub_id: assignment.hub_id,
            warehouse_id: assignment.warehouse_id
          }
        ) if was_new
      end

      def auto_assignment_attrs
        warehouse = @order.warehouse
        if warehouse.present?
          manager = facility_manager_user(role_name: "Warehouse Manager", warehouse_id: warehouse.id)
          return if manager.blank?

          return {
            assigned_to_id: manager.id,
            hub_id: nil,
            warehouse_id: warehouse.id
          }
        end

        hub = @order.hub
        return if hub.blank?

        manager = facility_manager_user(role_name: "Hub Manager", hub_id: hub.id)
        return if manager.blank?

        {
          assigned_to_id: manager.id,
          hub_id: hub.id,
          warehouse_id: nil
        }
      end

      def facility_manager_user(role_name:, hub_id: nil, warehouse_id: nil)
        UserAssignment.includes(:user)
                      .where(role_name: role_name, hub_id: hub_id, warehouse_id: warehouse_id)
                      .order(:id)
                      .map(&:user)
                      .find { |user| user&.active? }
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
