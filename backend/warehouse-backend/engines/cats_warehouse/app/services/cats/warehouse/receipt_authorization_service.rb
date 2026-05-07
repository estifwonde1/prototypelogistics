module Cats
  module Warehouse
    class ReceiptAuthorizationService
      def initialize(receipt_order:, actor:, store:, authorized_quantity:,
                     driver_name:, driver_id_number:, truck_plate_number:,
                     transporter:, waybill_number:,
                     receipt_order_assignment: nil)
        @receipt_order            = receipt_order
        @actor                    = actor
        @store                    = store
        @authorized_quantity      = authorized_quantity.to_f
        @driver_name              = driver_name
        @driver_id_number         = driver_id_number
        @truck_plate_number       = truck_plate_number
        @transporter              = transporter
        @waybill_number           = waybill_number.to_s.strip.presence
        @receipt_order_assignment = receipt_order_assignment
      end

      # ── Create ────────────────────────────────────────────────────────────
      def call
        warehouse = resolved_warehouse
        raise ArgumentError, "A destination warehouse could not be determined for this Receipt Authorization" if warehouse.blank?

        validate_warehouse_allocated!(warehouse)
        validate_quantity_within_allocation!(warehouse)

        ReceiptAuthorization.transaction do
          ra = ReceiptAuthorization.create!(
            receipt_order:            @receipt_order,
            receipt_order_assignment: @receipt_order_assignment,
            store:                    @store,
            warehouse:                warehouse,
            transporter:              @transporter,
            authorized_quantity:      @authorized_quantity,
            driver_name:              @driver_name,
            driver_id_number:         @driver_id_number,
            truck_plate_number:       @truck_plate_number,
            waybill_number:           resolved_waybill_number,
            status:                   ReceiptAuthorization::PENDING,
            reference_no:             generate_reference_no,
            created_by:               @actor
          )

          WorkflowEventRecorder.record!(
            entity:      @receipt_order,
            event_type:  "receipt_authorization.created",
            actor:       @actor,
            from_status: @receipt_order.status,
            to_status:   @receipt_order.status,
            payload:     {
              receipt_authorization_id: ra.id,
              store_id:                 @store&.id,
              warehouse_id:             warehouse.id,
              quantity:                 @authorized_quantity
            }
          )

          enqueue_notification("receipt_authorization.created",
                               receipt_authorization_id: ra.id,
                               store_id:                 ra.store_id,
                               warehouse_id:             ra.warehouse_id)

          ra
        end
      end

      # ── Cancel ────────────────────────────────────────────────────────────
      def self.cancel!(receipt_authorization:, actor:)
        ra = receipt_authorization

        raise ArgumentError, "Cannot cancel — Receipt Authorization is not Pending" unless ra.pending?
        raise ArgumentError, "Cannot cancel — an Inspection has already been recorded against this Receipt Authorization" if ra.inspection.present?

        ReceiptAuthorization.transaction do
          ra.update!(
            status:       ReceiptAuthorization::CANCELLED,
            cancelled_at: Time.current,
            cancelled_by: actor
          )

          WorkflowEventRecorder.record!(
            entity:      ra.receipt_order,
            event_type:  "receipt_authorization.cancelled",
            actor:       actor,
            from_status: ra.receipt_order.status,
            to_status:   ra.receipt_order.status,
            payload:     { receipt_authorization_id: ra.id }
          )

          enqueue_notification_static("receipt_authorization.cancelled",
                                      receipt_authorization_id: ra.id,
                                      store_id:                 ra.store_id)

          ra
        end
      end

      private

      def resolved_warehouse
        return @store.warehouse if @store.present?
        return @receipt_order_assignment.warehouse if @receipt_order_assignment&.warehouse.present?

        @receipt_order.warehouse
      end

      # ── Validations ───────────────────────────────────────────────────────

      def validate_warehouse_allocated!(warehouse)
        directly_targeted = @receipt_order.warehouse_id == warehouse.id
        has_assignment = @receipt_order.receipt_order_assignments
                                       .where(warehouse_id: warehouse.id)
                                       .where.not(status: "rejected")
                                       .exists?

        return if directly_targeted || has_assignment

        raise ArgumentError, "Destination warehouse is not allocated for this Receipt Order"
      end

      def validate_quantity_within_allocation!(warehouse)
        return if @authorized_quantity <= 0

        allocation = @receipt_order_assignment || find_allocation_for_warehouse(warehouse)
        return if allocation.nil? # standalone warehouse order — no assignment cap

        allocated_qty = allocation.quantity.to_f

        base_scope = ReceiptAuthorization.where(receipt_order: @receipt_order).where.not(
          status: ReceiptAuthorization::CANCELLED
        )

        existing_qty =
          if @receipt_order_assignment.present?
            base_scope.where(receipt_order_assignment_id: allocation.id).sum(:authorized_quantity).to_f
          else
            base_scope.where(warehouse: warehouse).sum(:authorized_quantity).to_f
          end

        remaining = allocated_qty - existing_qty

        return unless @authorized_quantity - remaining > 0.0001

        raise ArgumentError,
              "Cannot authorize #{@authorized_quantity}; only #{remaining.round(4)} remaining for this assignment"
      end

      def find_allocation_for_warehouse(warehouse)
        @receipt_order.receipt_order_assignments
                      .where(warehouse_id: warehouse.id)
                      .where.not(status: "rejected")
                      .order(:id)
                      .first
      end

      def generate_reference_no
        loop do
          ref = "RA-#{SecureRandom.hex(4).upcase}"
          break ref unless ReceiptAuthorization.exists?(reference_no: ref)
        end
      end

      def resolved_waybill_number
        @waybill_number || generate_waybill_number
      end

      def generate_waybill_number
        loop do
          ref = "WB-#{SecureRandom.hex(4).upcase}"
          break ref unless ReceiptAuthorization.exists?(waybill_number: ref)
        end
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end

      def self.enqueue_notification_static(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
