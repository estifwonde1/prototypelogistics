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
        # Create assignments for each destination specified in the receipt order lines
        create_assignments_from_destinations!
        
        # Fallback: if no assignments were created, create a single assignment to the order-level destination
        if @order.receipt_order_assignments.empty?
          create_fallback_assignment!
        end
      end

      def create_assignments_from_destinations!
        Rails.logger.info "DEBUG: Creating assignments from destinations for order #{@order.id}"
        @order.receipt_order_lines.each do |line|
          Rails.logger.info "DEBUG: Processing line #{line.id} with notes: '#{line.notes}'"
          destination_info = parse_destination_from_line_notes(line.notes)
          Rails.logger.info "DEBUG: Parsed destination info: #{destination_info.inspect}"
          
          unless destination_info
            Rails.logger.info "DEBUG: No destination info found for line #{line.id}, skipping"
            next
          end

          assignment_attrs = build_assignment_attrs(destination_info, line)
          Rails.logger.info "DEBUG: Built assignment attrs: #{assignment_attrs.inspect}"
          
          unless assignment_attrs
            Rails.logger.info "DEBUG: No assignment attrs built for line #{line.id}, skipping"
            next
          end

          assignment = ReceiptOrderAssignment.find_or_initialize_by(
            receipt_order: @order,
            receipt_order_line: line,
            hub_id: assignment_attrs[:hub_id],
            warehouse_id: assignment_attrs[:warehouse_id],
            store_id: nil
          )
          
          assignment.assigned_by = @confirmed_by || @order.confirmed_by || @order.created_by
          assignment.assigned_to_id = assignment_attrs[:assigned_to_id]
          assignment.quantity = line.quantity
          assignment.status = ContractConstants::DOCUMENT_STATUSES[:assigned]
          
          was_new = assignment.new_record?
          Rails.logger.info "DEBUG: Saving assignment for line #{line.id}, was_new: #{was_new}"
          
          begin
            assignment.save!
            Rails.logger.info "DEBUG: Successfully saved assignment #{assignment.id} for line #{line.id}"
          rescue => e
            Rails.logger.error "DEBUG: Failed to save assignment for line #{line.id}: #{e.message}"
            next
          end

          WorkflowEventRecorder.record!(
            entity: @order,
            event_type: "receipt_order.destination_auto_assigned",
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
          ) if was_new
        end
        
        Rails.logger.info "DEBUG: Finished creating assignments. Total assignments: #{@order.receipt_order_assignments.count}"
      end

      def parse_destination_from_line_notes(notes)
        return nil if notes.blank?
        
        # Parse notes format: "Hub: Hub Name | additional notes" or "Warehouse: Warehouse Name | additional notes"
        if notes.match(/^Hub:\s*(.+?)(?:\s*\|\s*.*)?$/i)
          hub_name = $1.strip
          hub = Hub.find_by(name: hub_name)
          return { type: 'hub', hub: hub } if hub
        elsif notes.match(/^Warehouse:\s*(.+?)(?:\s*\|\s*.*)?$/i)
          warehouse_name = $1.strip
          warehouse = Warehouse.find_by(name: warehouse_name)
          return { type: 'warehouse', warehouse: warehouse } if warehouse
        end
        
        nil
      end

      def build_assignment_attrs(destination_info, line)
        case destination_info[:type]
        when 'hub'
          hub = destination_info[:hub]
          manager = facility_manager_user(role_name: "Hub Manager", hub_id: hub.id)
          return nil unless manager

          {
            assigned_to_id: manager.id,
            hub_id: hub.id,
            warehouse_id: nil
          }
        when 'warehouse'
          warehouse = destination_info[:warehouse]
          manager = facility_manager_user(role_name: "Warehouse Manager", warehouse_id: warehouse.id)
          return nil unless manager

          {
            assigned_to_id: manager.id,
            hub_id: nil,
            warehouse_id: warehouse.id
          }
        else
          nil
        end
      end

      def create_fallback_assignment!
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
