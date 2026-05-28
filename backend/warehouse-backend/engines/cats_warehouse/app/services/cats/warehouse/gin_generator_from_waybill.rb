module Cats
  module Warehouse
    class GinGeneratorFromWaybill
      def initialize(waybill:, actor:)
        @waybill = waybill
        @actor = actor
      end

      def call
        return @waybill.auto_generated_gin if @waybill.auto_generated_gin.present?

        warehouse = resolve_warehouse

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

      def resolve_warehouse
        auth = @waybill.dispatch_order_authorization
        return auth.warehouse if auth.present?

        order_wh = @waybill.dispatch_order&.warehouse
        return order_wh if order_wh.present?

        Warehouse.find_by!(location_id: @waybill.source_location_id)
      end

      def build_items
        store_id = resolve_store_id_for_items

        @waybill.waybill_items.map do |item|
          {
            commodity_id: item.commodity_id,
            quantity: item.quantity,
            unit_id: item.unit_id,
            inventory_lot_id: item.inventory_lot_id,
            entered_unit_id: item.entered_unit_id,
            base_unit_id: item.base_unit_id,
            base_quantity: item.base_quantity,
            store_id: store_id
          }
        end
      end

      def resolve_store_id_for_items
        auth = @waybill.dispatch_order_authorization
        return nil if auth.blank?

        execution = auth.dispatch_order_authorization_executions.order(created_at: :desc).first
        if execution&.dispatch_order_authorization_store
          return execution.dispatch_order_authorization_store.store_id
        end

        auth.dispatch_order_authorization_stores.order(:id).first&.store_id
      end
    end
  end
end
