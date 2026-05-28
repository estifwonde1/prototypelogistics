# frozen_string_literal: true

module Cats
  module Warehouse
    # Links admin CommodityDefinition records to batch-level Cats::Core::Commodity rows (matched by name).
    class CommodityDefinitionStockResolver
      def self.core_commodity_scope_for_definition(definition)
        normalized = normalize_name(definition.name)
        return Cats::Core::Commodity.none if normalized.blank?

        Cats::Core::Commodity.where("LOWER(TRIM(name)) = ?", normalized)
      end

      def self.core_commodity_ids_for_definition(definition)
        core_commodity_scope_for_definition(definition).pluck(:id)
      end

      def self.definition_for_core_commodity(commodity)
        normalized = normalize_name(core_commodity_catalog_name(commodity))
        return nil if normalized.blank?

        CommodityDefinition.find_by("LOWER(TRIM(name)) = ?", normalized)
      end

      # Cats::Core::Commodity#name delegates to donor metadata and can raise; use the stored column.
      def self.core_commodity_catalog_name(commodity)
        return commodity.to_s unless commodity.is_a?(Cats::Core::Commodity)

        commodity.read_attribute(:name).presence ||
          commodity.batch_no.presence ||
          commodity.description.to_s
      end

      # Representative core commodity row for persisting dispatch lines (prefer row with stock).
      def self.primary_core_commodity_id(definition)
        scope = core_commodity_scope_for_definition(definition)
        return nil if scope.none?

        stocked_id = StockBalance
          .where(commodity_id: scope.select(:id))
          .where("COALESCE(available_quantity, quantity - COALESCE(reserved_quantity, 0)) > 0")
          .order(commodity_id: :asc)
          .limit(1)
          .pick(:commodity_id)

        stocked_id || scope.order(:id).pick(:id)
      end

      def self.default_unit_id_for_definition(definition)
        scope = core_commodity_scope_for_definition(definition)
        scope.order(:id).pick(:unit_of_measure_id)
      end

      def self.normalize_name(value)
        value.to_s.strip.downcase
      end

      def self.core_commodity_ids_for_core_commodity(commodity_id)
        cid = commodity_id.to_i
        return [] unless cid.positive?

        commodity = Cats::Core::Commodity.find_by(id: cid)
        return [cid] if commodity.blank?

        definition = definition_for_core_commodity(commodity)
        ids = definition.present? ? core_commodity_ids_for_definition(definition) : []

        if ids.blank?
          normalized = normalize_name(core_commodity_catalog_name(commodity))
          ids = Cats::Core::Commodity.where("LOWER(TRIM(name)) = ?", normalized).pluck(:id) if normalized.present?
        end

        ids = [cid] if ids.blank?
        ids.map(&:to_i).uniq
      end

      def self.resolve_line_commodity_id(attrs)
        attrs = attrs.to_h.with_indifferent_access
        if attrs[:commodity_definition_id].present?
          definition = CommodityDefinition.find(attrs[:commodity_definition_id])
          cid = primary_core_commodity_id(definition)
          raise ArgumentError,
                "No received inventory exists yet for #{definition.name}. Receive stock before dispatching." if cid.blank?

          return cid
        end

        cid = attrs[:commodity_id].to_i
        raise ArgumentError, "commodity_id or commodity_definition_id is required" unless cid.positive?

        cid
      end
    end
  end
end
