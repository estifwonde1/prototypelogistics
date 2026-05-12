module Cats
  module Warehouse
    class DriverConfirmService
      # inspection_id: the specific inspection this storekeeper is confirming.
      # Each storekeeper confirms their own inspection → gets their own GRN.
      def initialize(receipt_authorization:, actor:, inspection_id: nil)
        @ra             = receipt_authorization
        @actor          = actor
        @inspection_id  = inspection_id
      end

      def call
        inspection = resolve_inspection!
        validate!(inspection)

        ReceiptAuthorization.transaction do
          # Mark this specific inspection as driver-confirmed
          inspection.update!(
            driver_confirmed_at: Time.current,
            driver_confirmed_by: @actor
          ) if inspection.respond_to?(:driver_confirmed_at)

          # Record on the RA itself (first confirmation sets the RA-level timestamp)
          if @ra.driver_confirmed_at.blank?
            @ra.update!(
              driver_confirmed_at: Time.current,
              driver_confirmed_by: @actor
            )
          end

          # Create a GRN in Draft status for this storekeeper's inspection
          grn = create_draft_grn!(inspection)

          WorkflowEventRecorder.record!(
            entity:      @ra.receipt_order,
            event_type:  "receipt_authorization.driver_confirmed",
            actor:       @actor,
            from_status: @ra.receipt_order.status,
            to_status:   @ra.receipt_order.status,
            payload:     {
              receipt_authorization_id: @ra.id,
              inspection_id:            inspection.id,
              grn_id:                   grn.id,
              grn_reference_no:         grn.reference_no
            }
          )

          enqueue_notification("receipt_authorization.driver_confirmed",
                               receipt_authorization_id: @ra.id,
                               grn_id: grn.id)

          @ra
        end
      end

      private

      def resolve_inspection!
        if @inspection_id.present?
          insp = @ra.inspections.find_by(id: @inspection_id)
          raise ArgumentError, "Inspection not found for this Receipt Authorization" unless insp
          return insp
        end

        # Fallback: use the most recent inspection that doesn't have a GRN yet
        insp = @ra.inspections
                   .left_joins(:auto_generated_grn)
                   .where(cats_warehouse_grns: { id: nil })
                   .order(created_at: :desc)
                   .first

        raise ArgumentError, "Cannot confirm driver — no unconfirmed Inspection found for this Receipt Authorization" unless insp
        insp
      end

      def validate!(inspection)
        raise ArgumentError, "Receipt Authorization must be Active" unless @ra.active?
        raise ArgumentError, "This inspection already has a GRN" if inspection.auto_generated_grn.present?
      end

      def create_draft_grn!(inspection)
        warehouse = @ra.warehouse

        grn_item_attrs = inspection.inspection_items.map do |item|
          {
            commodity_id:      item.commodity_id,
            quantity:          item.quantity_received.to_f,
            unit_id:           item.entered_unit_id || item.unit_id,
            quality_status:    item.quality_status,
            inventory_lot_id:  item.inventory_lot_id,
            line_reference_no: SourceDetailReference.generate_unique
          }
        end

        raise ArgumentError, "No received items found in inspection" if grn_item_attrs.empty?

        reference_no = "GRN-RA#{@ra.id}-INS#{inspection.id}-#{Time.current.strftime('%Y%m%d%H%M%S')}"

        grn = Grn.create!(
          warehouse:                  warehouse,
          received_on:                Date.current,
          received_by:                @actor,
          receipt_order:              @ra.receipt_order,
          receipt_authorization:      @ra,
          generated_from_inspection:  inspection,
          source:                     @ra.receipt_order,
          reference_no:               reference_no,
          status:                     "draft"
        )

        grn_item_attrs.each do |attrs|
          grn.grn_items.create!(attrs)
        end

        grn
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end
    end
  end
end
