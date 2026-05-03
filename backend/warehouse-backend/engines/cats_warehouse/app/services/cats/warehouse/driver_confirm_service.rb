module Cats
  module Warehouse
    class DriverConfirmService
      def initialize(receipt_authorization:, actor:)
        @ra    = receipt_authorization
        @actor = actor
      end

      def call
        validate!

        ReceiptAuthorization.transaction do
          # Record driver confirmation
          @ra.update!(
            driver_confirmed_at: Time.current,
            driver_confirmed_by: @actor
          )

          # Create GRN in Draft status — driver can sign at this point
          grn = create_draft_grn!

          WorkflowEventRecorder.record!(
            entity:      @ra.receipt_order,
            event_type:  "receipt_authorization.driver_confirmed",
            actor:       @actor,
            from_status: @ra.receipt_order.status,
            to_status:   @ra.receipt_order.status,
            payload:     {
              receipt_authorization_id: @ra.id,
              grn_id: grn.id,
              grn_reference_no: grn.reference_no
            }
          )

          enqueue_notification("receipt_authorization.driver_confirmed",
                               receipt_authorization_id: @ra.id,
                               grn_id: grn.id)

          @ra
        end
      end

      private

      def validate!
        raise ArgumentError, "Receipt Authorization must be Active" unless @ra.active?
        raise ArgumentError, "Cannot confirm driver — no Inspection has been recorded for this Receipt Authorization" if @ra.inspection.nil?
        raise ArgumentError, "Driver confirmation has already been recorded" if @ra.driver_confirmed_at.present?
      end

      def create_draft_grn!
        inspection = @ra.inspection
        warehouse  = @ra.warehouse

        # Build GRN items from inspection items
        grn_item_attrs = inspection.inspection_items.map do |item|
          {
            commodity_id:    item.commodity_id,
            quantity:        item.quantity_received.to_f,
            unit_id:         item.entered_unit_id || item.unit_id,
            quality_status:  item.quality_status,
            inventory_lot_id: item.inventory_lot_id,
            line_reference_no: SourceDetailReference.generate_unique
          }
        end

        raise ArgumentError, "No received items found in inspection" if grn_item_attrs.empty?

        reference_no = "GRN-RA#{@ra.id}-#{Time.current.strftime('%Y%m%d%H%M%S')}"

        grn = Grn.create!(
          warehouse:                  warehouse,
          received_on:                Date.current,
          received_by:                @actor,
          receipt_order:              @ra.receipt_order,
          receipt_authorization:      @ra,
          generated_from_inspection:  inspection,
          reference_no:               reference_no,
          status:                     "draft"
        )

        grn_item_attrs.each do |attrs|
          grn.grn_items.create!(attrs)
        end

        grn
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
