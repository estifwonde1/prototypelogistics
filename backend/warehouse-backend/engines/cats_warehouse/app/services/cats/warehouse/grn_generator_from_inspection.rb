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
          status: ContractConstants::DOCUMENT_STATUSES[:draft]
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

          unit_id = resolved_unit_id(item)
          raise ArgumentError, "Cannot determine unit for inspection item #{item.id}" if unit_id.blank?

          {
            commodity_id: item.commodity_id,
            quantity: accepted_quantity,
            unit_id: unit_id,
            inventory_lot_id: item.inventory_lot_id,
            entered_unit_id: item.entered_unit_id.presence || unit_id,
            base_unit_id: item.base_unit_id,
            base_quantity: item.base_quantity,
            quality_status: item.quality_status
          }
        end.compact
      end

      # Prefer the unit the storekeeper/hub captured on the line (entered_unit_id), then the receipt
      # order line unit (hub intake UOM), then the commodity default — never prefer a non-persisted
      # inspection "unit_id" or a wrong attribute name on Commodity.
      def resolved_unit_id(item)
        return item.entered_unit_id if item.entered_unit_id.present?

        uid = receipt_order_line_unit_id_for(item)
        return uid if uid.present?

        commodity_default_unit_id(item.commodity_id)
      end

      def receipt_order_line_unit_id_for(item)
        line = @inspection.receipt_authorization&.receipt_order_line
        return line.unit_id if line&.unit_id

        ro = @inspection.receipt_order
        return nil unless ro

        ro.receipt_order_lines.find_by(commodity_id: item.commodity_id)&.unit_id ||
          ro.receipt_order_lines.pick(:unit_id)
      end

      def commodity_default_unit_id(commodity_id)
        Cats::Core::Commodity.where(id: commodity_id).pick(:unit_of_measure_id)
      end
    end
  end
end
