module Cats
  module Warehouse
    class GinGeneratorFromWaybill
      def initialize(waybill:, actor:)
        @waybill = waybill
        @actor = actor
      end

      def call
        return @waybill.auto_generated_gin if @waybill.auto_generated_gin.present?

        warehouse = @waybill.dispatch_order&.warehouse || Warehouse.find_by!(location_id: @waybill.source_location_id)

        gin = GinCreator.new(
          warehouse: warehouse,
          issued_on: @waybill.issued_on,
          issued_by: @actor,
          items: build_items,
          destination: @waybill.dispatch_order&.destination,
          reference_no: "AUTO-GIN-#{@waybill.id}",
          status: ContractConstants::DOCUMENT_STATUSES[:draft]
        ).call

        gin.update!(
          dispatch_order_id: @waybill.dispatch_order_id,
          generated_from_waybill: @waybill,
          workflow_status: "Generated"
        )

        @waybill.update!(auto_generated_gin: gin)
        WorkflowEventRecorder.record!(entity: @waybill, event_type: "waybill.gin_generated", actor: @actor, payload: { gin_id: gin.id })
        gin
      end

      private

      def build_items
        @waybill.waybill_items.map do |item|
          {
            commodity_id: item.commodity_id,
            quantity: item.quantity,
            unit_id: item.unit_id,
            inventory_lot_id: item.inventory_lot_id,
            entered_unit_id: item.entered_unit_id,
            base_unit_id: item.base_unit_id,
            base_quantity: item.base_quantity
          }
        end
      end
    end
  end
end
