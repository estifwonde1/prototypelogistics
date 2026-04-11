module Cats
  module Warehouse
    class GinCreator
      def initialize(warehouse:, issued_on:, issued_by:, items:, destination: nil, reference_no: nil, status: "draft")
        @warehouse = warehouse
        @issued_on = issued_on
        @issued_by = issued_by
        @items = items
        @destination = destination
        @reference_no = reference_no
        @status = status
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        Gin.transaction do
          gin = Gin.create!(
            warehouse: @warehouse,
            issued_on: @issued_on,
            issued_by: @issued_by,
            destination: @destination,
            reference_no: @reference_no,
            status: @status
          )

          @items.each do |item|
            raise ArgumentError, "quantity must be positive" unless item[:quantity].to_f.positive?

            unit_id = fetch_id(item, :unit)
            entered_unit_id = fetch_id(item, :entered_unit, optional: true) || unit_id
            base_unit_id = fetch_id(item, :base_unit, optional: true)
            base_quantity = item[:base_quantity]

            store_id = fetch_id(item, :store, optional: true)
            stack_id = fetch_id(item, :stack, optional: true)
            lot_id = fetch_id(item, :inventory_lot, optional: true)
            lot_id ||= infer_inventory_lot_for_issue(
              warehouse: @warehouse,
              commodity_id: fetch_id(item, :commodity),
              unit_id: unit_id,
              store_id: store_id,
              stack_id: stack_id
            )

            gin.gin_items.create!(
              commodity_id: fetch_id(item, :commodity),
              quantity: item[:quantity],
              unit_id: unit_id,
              inventory_lot_id: lot_id,
              entered_unit_id: entered_unit_id,
              base_unit_id: base_unit_id,
              base_quantity: base_quantity,
              store_id: store_id,
              stack_id: stack_id
            )
          end

          gin
        end
      end

      private

      def fetch_id(item, key, optional: false)
        value = item[key] || item[:"#{key}_id"]
        return value&.id if value.respond_to?(:id)
        return value if value.present?
        return nil if optional

        raise ArgumentError, "#{key} is required"
      end

      # When the client omits lot on a GIN line, attach the only lot with on-hand stock at the
      # store/stack (matches GRN intake that always records a lot per line reference / batch).
      def infer_inventory_lot_for_issue(warehouse:, commodity_id:, unit_id:, store_id:, stack_id:)
        return nil if store_id.blank? || stack_id.blank?

        lot_ids = StockBalance.where(
          warehouse_id: warehouse.id,
          store_id: store_id,
          stack_id: stack_id,
          commodity_id: commodity_id,
          unit_id: unit_id
        ).where("quantity > 0").where.not(inventory_lot_id: nil).distinct.pluck(:inventory_lot_id)

        lot_ids.one? ? lot_ids.first : nil
      end
    end
  end
end
