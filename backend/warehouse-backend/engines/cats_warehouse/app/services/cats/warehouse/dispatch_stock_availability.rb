# frozen_string_literal: true

module Cats
  module Warehouse
    # Aggregate available quantity per warehouse for a commodity (all batches sharing the definition name).
    class DispatchStockAvailability
      def self.available_base_quantity_per_warehouse(commodity_id: nil, commodity_definition_id: nil, commodity_ids: nil, warehouse_ids:)
        new(
          commodity_id: commodity_id,
          commodity_definition_id: commodity_definition_id,
          commodity_ids: commodity_ids,
          warehouse_ids: warehouse_ids
        ).available_base_quantity_per_warehouse
      end

      def self.available_in_unit(commodity_id: nil, commodity_definition_id: nil, warehouse_id:, unit_id:)
        instance = new(
          commodity_id: commodity_id,
          commodity_definition_id: commodity_definition_id,
          warehouse_ids: [warehouse_id]
        )
        base_unit_id = instance.base_unit_id
        per_wh = instance.available_base_quantity_per_warehouse
        base = per_wh[warehouse_id.to_i].to_f
        return base if base_unit_id.blank? || unit_id.to_i == base_unit_id.to_i

        UomConversionResolver.convert(
          base,
          from_unit_id: base_unit_id,
          to_unit_id: unit_id,
          commodity_id: instance.conversion_commodity_id
        )
      end

      attr_reader :base_unit_id, :commodity_ids, :conversion_commodity_id

      def initialize(commodity_id: nil, commodity_definition_id: nil, commodity_ids: nil, warehouse_ids:)
        @warehouse_ids = Array(warehouse_ids).map(&:to_i).reject(&:zero?).uniq
        @commodity_ids = resolve_commodity_ids(commodity_id, commodity_definition_id, commodity_ids)
        @conversion_commodity_id = @commodity_ids.first
        @base_unit_id =
          if @conversion_commodity_id.present?
            Cats::Core::Commodity.find_by(id: @conversion_commodity_id)&.unit_of_measure_id
          end
      end

      # @return [Hash{Integer => Float}] warehouse_id => available quantity in commodity base UOM
      def available_base_quantity_per_warehouse
        return {} if @warehouse_ids.empty? || @commodity_ids.empty?

        totals = Hash.new(0.0)
        StockBalance.where(commodity_id: @commodity_ids, warehouse_id: @warehouse_ids).find_each do |row|
          avail_pkg = available_units_on_row(row)
          next if avail_pkg <= 0

          base_contrib =
            if row.base_quantity.present? && row.quantity.to_f.positive?
              (avail_pkg / row.quantity.to_f) * row.base_quantity.to_f
            elsif @base_unit_id.present?
              UomConversionResolver.convert(
                avail_pkg,
                from_unit_id: row.unit_id,
                to_unit_id: @base_unit_id,
                commodity_id: row.commodity_id
              )
            else
              avail_pkg
            end

          totals[row.warehouse_id] += base_contrib.to_f
        end

        totals
      end

      def total_available_base
        available_base_quantity_per_warehouse.values.sum
      end

      private

      def resolve_commodity_ids(commodity_id, commodity_definition_id, commodity_ids)
        if commodity_ids.present?
          return Array(commodity_ids).map(&:to_i).reject(&:zero?).uniq
        end

        if commodity_definition_id.present?
          definition = CommodityDefinition.find(commodity_definition_id)
          ids = CommodityDefinitionStockResolver.core_commodity_ids_for_definition(definition)
          return ids if ids.any?

          return []
        end

        cid = commodity_id.to_i
        cid.positive? ? [cid] : []
      end

      def available_units_on_row(row)
        if row.available_quantity.present?
          row.available_quantity.to_f
        else
          [row.quantity.to_f - row.reserved_quantity.to_f, 0.0].max
        end
      end
    end
  end
end
