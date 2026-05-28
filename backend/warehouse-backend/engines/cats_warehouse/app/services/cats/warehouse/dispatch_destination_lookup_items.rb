# frozen_string_literal: true

module Cats
  module Warehouse
    # Builds ordered lookup rows for dispatch destinations (warehouses first, then FDPs).
    class DispatchDestinationLookupItems
      KINDS = %w[all warehouse fdp].freeze

      def self.call(access:, destination_kind: "all", hub_id: nil, query: nil)
        new(access: access, destination_kind: destination_kind, hub_id: hub_id, query: query).call
      end

      def initialize(access:, destination_kind: "all", hub_id: nil, query: nil)
        @access = access
        @destination_kind = normalize_kind(destination_kind)
        @hub_id = hub_id
        @query = query.to_s.strip
      end

      def call
        scope = DispatchDestinationLookupScope.call(access: @access, hub_id: @hub_id)
        items = []
        warehouse_destination_location_ids = Set.new

        if include_warehouses?
          scope.warehouses_scope.find_each do |warehouse|
            next if warehouse.location_id.blank?
            next if warehouse_destination_location_ids.include?(warehouse.location_id)

            warehouse_destination_location_ids << warehouse.location_id
            items << warehouse_row(warehouse)
          end
        end

        if include_fdps?
          scope.fdp_locations_scope.find_each do |location|
            next if warehouse_destination_location_ids.include?(location.id)

            items << fdp_row(location)
          end
        end

        filter_by_query(items)
      end

      private

      def normalize_kind(kind)
        normalized = kind.to_s.strip.downcase
        KINDS.include?(normalized) ? normalized : "all"
      end

      def include_warehouses?
        @destination_kind == "all" || @destination_kind == "warehouse"
      end

      def include_fdps?
        @destination_kind == "all" || @destination_kind == "fdp"
      end

      def warehouse_row(warehouse)
        {
          id: warehouse.location_id,
          name: warehouse.name,
          code: warehouse.code,
          label: lookup_label(warehouse.name, warehouse.code),
          location_type: Cats::Core::Location::WAREHOUSE,
          meta: { warehouse_id: warehouse.id }
        }
      end

      def fdp_row(location)
        {
          id: location.id,
          name: location.name,
          code: location.code,
          label: lookup_label(location.name, location.code),
          location_type: location.location_type,
          meta: {}
        }
      end

      def lookup_label(name, code)
        code.present? ? "#{name} (#{code})" : name.to_s
      end

      def filter_by_query(items)
        return items if @query.blank?

        needle = @query.downcase
        items.select do |item|
          item[:name].to_s.downcase.include?(needle) ||
            item[:code].to_s.downcase.include?(needle) ||
            item[:label].to_s.downcase.include?(needle)
        end
      end
    end
  end
end
