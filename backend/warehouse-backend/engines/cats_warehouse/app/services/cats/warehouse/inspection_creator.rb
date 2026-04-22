module Cats
  module Warehouse
    class InspectionCreator
      def initialize(warehouse:, inspected_on:, inspector:, items:, source: nil, reference_no: nil, status: "draft", receipt_order: nil, dispatch_order: nil)
        @warehouse = warehouse
        @inspected_on = inspected_on
        @inspector = inspector
        @items = items
        @source = source
        @reference_no = reference_no
        @status = status
        @receipt_order = receipt_order
        @dispatch_order = dispatch_order
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        Inspection.transaction do
          inspection = Inspection.create!(
            warehouse: @warehouse,
            inspected_on: @inspected_on,
            inspector: @inspector,
            source: @source,
            reference_no: @reference_no,
            status: @status,
            receipt_order: @receipt_order,
            dispatch_order: @dispatch_order
          )

          @items.each do |item|
            raise ArgumentError, "quantity_received must be positive" unless item[:quantity_received].to_f.positive?

            commodity_id = fetch_id(item, :commodity)
            unit_id = fetch_id(item, :unit, optional: true)

            lot_id = fetch_id(item, :inventory_lot, optional: true)
            line_ref = item[:line_reference_no].presence || item[:batch_no].presence

            if lot_id.present?
              lot = InventoryLot.find_by(id: lot_id)
              raise ArgumentError, "inventory lot not found" unless lot

              line_ref = line_ref.presence || SourceDetailReference.generate_unique

              if SourceDetailReference.taken?(line_ref)
                raise ArgumentError, "line_reference_no #{line_ref} is already in use"
              end
            else
              line_ref = SourceDetailReference.generate_unique if line_ref.blank?

              if SourceDetailReference.taken?(line_ref)
                raise ArgumentError, "line_reference_no #{line_ref} is already in use"
              end

              lot_id = InventoryLotResolver.resolve(
                warehouse: @warehouse,
                commodity_id: commodity_id,
                batch_no: line_ref,
                expiry_date: item[:expiry_date],
                source: @source,
                lot_code: item[:lot_code],
                received_on: @inspected_on,
                manufactured_on: item[:manufactured_on]
              )&.id
            end

            entered_unit_id = fetch_id(item, :entered_unit, optional: true) || unit_id
            base_unit_id = fetch_id(item, :base_unit, optional: true)
            base_quantity = item[:base_quantity]

            inspection.inspection_items.create!(
              commodity_id: commodity_id,
              inventory_lot_id: lot_id,
              line_reference_no: line_ref,
              entered_unit_id: entered_unit_id,
              base_unit_id: base_unit_id,
              base_quantity: base_quantity,
              quantity_received: item[:quantity_received],
              quantity_damaged: item[:quantity_damaged] || 0,
              quantity_lost: item[:quantity_lost] || 0,
              quality_status: item[:quality_status],
              packaging_condition: item[:packaging_condition],
              remarks: item[:remarks]
            )
          end

          inspection
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
    end
  end
end
