module Cats
  module Warehouse
    class GrnCreator
      def initialize(warehouse:, received_on:, received_by:, items:, source: nil, reference_no: nil, status: "draft")
        @warehouse = warehouse
        @received_on = received_on
        @received_by = received_by
        @items = items
        @source = source
        @reference_no = reference_no
        @status = status
      end

      def call
        raise ArgumentError, "items are required" if @items.nil? || @items.empty?

        Grn.transaction do
          grn = Grn.create!(
            warehouse: @warehouse,
            received_on: @received_on,
            received_by: @received_by,
            source: @source,
            reference_no: @reference_no,
            status: @status
          )

          @items.each do |item|
            raise ArgumentError, "quantity must be positive" unless item[:quantity].to_f.positive?

            commodity_id = fetch_id(item, :commodity)
            unit_id = fetch_id(item, :unit)

            lot_id = fetch_id(item, :inventory_lot, optional: true)
            line_ref = item[:line_reference_no].presence || item[:batch_no].presence

            if lot_id.present?
              lot = InventoryLot.find_by(id: lot_id)
              raise ArgumentError, "inventory lot not found" unless lot

              # Line reference identifies this document row; it may differ from the lot's batch when
              # reusing an existing lot (e.g. auto GRN from inspection already has a ref on the inspection line).
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
                received_on: @received_on,
                manufactured_on: item[:manufactured_on]
              )&.id
            end

            entered_unit_id = fetch_id(item, :entered_unit, optional: true) || unit_id
            base_unit_id = fetch_id(item, :base_unit, optional: true)
            base_quantity = item[:base_quantity]

            grn.grn_items.create!(
              commodity_id: commodity_id,
              quantity: item[:quantity],
              unit_id: unit_id,
              inventory_lot_id: lot_id,
              line_reference_no: line_ref,
              entered_unit_id: entered_unit_id,
              base_unit_id: base_unit_id,
              base_quantity: base_quantity,
              quality_status: item[:quality_status],
              store_id: fetch_id(item, :store, optional: true),
              stack_id: fetch_id(item, :stack, optional: true)
            )
          end

          grn
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
