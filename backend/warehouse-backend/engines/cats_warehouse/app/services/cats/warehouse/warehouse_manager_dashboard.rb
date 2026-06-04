module Cats
  module Warehouse
    class WarehouseManagerDashboard
      include ContractConstants

      PENDING_RECEIPT_STATUSES = [
        DOCUMENT_STATUSES[:draft],
        DOCUMENT_STATUSES[:confirmed]
      ].freeze

      def initialize(warehouse_id:)
        @warehouse_id = warehouse_id.to_i
      end

      def call
        receipt_scope = scoped_receipt_orders
        dispatch_scope = scoped_dispatch_orders

        {
          receipt_orders: status_counts(receipt_scope),
          dispatch_orders: status_counts(dispatch_scope),
          pending_receipt_orders: pending_receipt_preview(receipt_scope),
          pending_dispatch_orders: pending_dispatch_preview(dispatch_scope),
          stock_preview: stock_preview,
          lost_commodity_records: lost_commodity_records
        }
      end

      private

      def scoped_receipt_orders
        WarehouseReceiptOrderScope.relation_for_warehouse(warehouse_id: @warehouse_id)
      end

      def scoped_dispatch_orders
        DispatchOrder.where(warehouse_id: @warehouse_id)
      end

      def status_counts(scope)
        scope.unscope(:order).group(:status).count.transform_keys { |status| status.to_s.titleize }
      end

      def pending_receipt_preview(scope)
        scope
          .where(status: PENDING_RECEIPT_STATUSES)
          .order(created_at: :desc)
          .limit(10)
          .map do |order|
            {
              id: order.id,
              reference_no: order.reference_no,
              source_name: receipt_source_name(order),
              created_at: order.created_at
            }
          end
      end

      def pending_dispatch_preview(scope)
        scope
          .where(status: DOCUMENT_STATUSES[:draft])
          .includes(:location)
          .order(created_at: :desc)
          .limit(10)
          .map do |order|
            {
              id: order.id,
              destination_name: dispatch_destination_name(order),
              expected_pickup_date: order.dispatched_date
            }
          end
      end

      def stock_preview
        StockBalance
          .where(warehouse_id: @warehouse_id)
          .includes(:commodity, :unit)
          .order(:id)
          .limit(6)
          .map do |balance|
            {
              id: balance.id,
              commodity_name: balance.commodity&.read_attribute(:name).presence || balance.commodity&.batch_no,
              quantity: balance.quantity,
              unit_name: balance.unit&.name
            }
          end
      end

      def lost_commodity_records
        InspectionItem
          .joins(:inspection)
          .where(cats_warehouse_inspections: { warehouse_id: @warehouse_id })
          .where("cats_warehouse_inspection_items.quantity_lost > 0")
          .includes(:commodity, :inspection)
          .order("cats_warehouse_inspection_items.created_at DESC")
          .limit(50)
          .map do |item|
            inspection = item.inspection
            {
              receipt_order_id: inspection&.receipt_order_id,
              commodity_name: item.commodity&.read_attribute(:name).presence || item.commodity&.batch_no,
              quantity_lost: item.quantity_lost,
              remarks: item.remarks,
              inspected_on: inspection&.inspected_on
            }
          end
      end

      def receipt_source_name(order)
        return order.name if order.name.present?

        order.reference_no.presence || "Receipt ##{order.id}"
      end

      def dispatch_destination_name(order)
        order.name.presence || order.location&.name || order.reference_no.presence || "Dispatch ##{order.id}"
      end
    end
  end
end
