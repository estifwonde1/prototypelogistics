module Cats
  module Warehouse
    class GrnGeneratorFromInspection
      def initialize(inspection:, actor:)
        @inspection = inspection
        @actor = actor
      end

      def call
        return @inspection.auto_generated_grn if @inspection.auto_generated_grn.present?

        grn = GrnCreator.new(
          warehouse: @inspection.warehouse,
          received_on: @inspection.inspected_on,
          received_by: @actor,
          items: build_items,
          source: @inspection,
          reference_no: "AUTO-GRN-#{@inspection.id}",
          status: "Draft"
        ).call

        grn.update!(
          receipt_order_id: @inspection.receipt_order_id,
          generated_from_inspection: @inspection,
          workflow_status: "Generated"
        )

        @inspection.update!(auto_generated_grn: grn)
        WorkflowEventRecorder.record!(entity: @inspection, event_type: "inspection.grn_generated", actor: @actor, payload: { grn_id: grn.id })
        grn
      end

      private

      def build_items
        @inspection.inspection_items.map do |item|
          accepted_quantity = item.quantity_received.to_f - item.quantity_damaged.to_f - item.quantity_lost.to_f
          next if accepted_quantity <= 0

          {
            commodity_id: item.commodity_id,
            quantity: accepted_quantity,
            unit_id: item.unit_id,
            inventory_lot_id: item.inventory_lot_id,
            batch_no: item.try(:batch_no),
            expiry_date: item.try(:expiry_date),
            entered_unit_id: item.entered_unit_id,
            base_unit_id: item.base_unit_id,
            base_quantity: item.base_quantity,
            quality_status: item.quality_status
          }
        end.compact
      end
    end
  end
end
