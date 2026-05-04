module Cats
  module Warehouse
    class ReceiptAuthorizationService
      def initialize(receipt_order:, actor:, store:, authorized_quantity:,
                     driver_name:, driver_id_number:, truck_plate_number:,
                     transporter:, waybill_number:,
                     receipt_order_assignment: nil)
        @receipt_order          = receipt_order
        @actor                  = actor
        @store                  = store
        @authorized_quantity    = authorized_quantity.to_f
        @driver_name            = driver_name
        @driver_id_number       = driver_id_number
        @truck_plate_number     = truck_plate_number
        @transporter            = transporter
        @waybill_number         = waybill_number
        @receipt_order_assignment = receipt_order_assignment
      end

      # ── Create ────────────────────────────────────────────────────────────
      def call
        validate_store_belongs_to_allocated_warehouse!
        validate_quantity_within_allocation!

        ReceiptAuthorization.transaction do
          ra = ReceiptAuthorization.create!(
            receipt_order:            @receipt_order,
            receipt_order_assignment: @receipt_order_assignment,
            store:                    @store,
            warehouse:                @store.warehouse,
            transporter:              @transporter,
            authorized_quantity:      @authorized_quantity,
            driver_name:              @driver_name,
            driver_id_number:         @driver_id_number,
            truck_plate_number:       @truck_plate_number,
            waybill_number:           @waybill_number,
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
            payload:     { receipt_authorization_id: ra.id, store_id: @store.id, quantity: @authorized_quantity }
          )

          enqueue_notification("receipt_authorization.created",
                               receipt_authorization_id: ra.id,
                               store_id: @store.id)

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
                                      store_id: ra.store_id)

          ra
        end
      end

      private

      # ── Validations ───────────────────────────────────────────────────────

      def validate_store_belongs_to_allocated_warehouse!
        warehouse = @store.warehouse
        return if warehouse.blank?

        # Check if this warehouse is allocated under the receipt order
        # Either the order targets this warehouse directly, or there's an assignment for it
        directly_targeted = @receipt_order.warehouse_id == warehouse.id
        has_assignment = @receipt_order.receipt_order_assignments
                                       .where(warehouse_id: warehouse.id)
                                       .where.not(status: "rejected")
                                       .exists?

        return if directly_targeted || has_assignment

        raise ArgumentError, "Destination store does not belong to an allocated warehouse for this Receipt Order"
      end

      def validate_quantity_within_allocation!
        return if @authorized_quantity <= 0

        # Find the allocation for this warehouse
        warehouse = @store.warehouse
        allocation = find_allocation_for_warehouse(warehouse)

        return if allocation.nil? # standalone warehouse order — no assignment cap

        allocated_qty = allocation.quantity.to_f

        # Sum of existing non-cancelled RAs for this assignment
        existing_qty = ReceiptAuthorization
          .where(receipt_order: @receipt_order)
          .where(warehouse: warehouse)
          .where.not(status: ReceiptAuthorization::CANCELLED)
          .sum(:authorized_quantity)
          .to_f

        remaining = allocated_qty - existing_qty

        if @authorized_quantity - remaining > 0.0001
          raise ArgumentError,
                "Cannot authorize #{@authorized_quantity}; only #{remaining.round(4)} remaining for this assignment"
        end
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

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end

      def self.enqueue_notification_static(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
