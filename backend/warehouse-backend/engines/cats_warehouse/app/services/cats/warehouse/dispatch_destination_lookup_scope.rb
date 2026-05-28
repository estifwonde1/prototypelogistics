# frozen_string_literal: true

module Cats
  module Warehouse
    # Resolves warehouse records and FDP locations within officer jurisdiction for dispatch destinations.
    class DispatchDestinationLookupScope
      def self.call(access:, hub_id: nil)
        new(access: access, hub_id: hub_id)
      end

      def initialize(access:, hub_id: nil)
        @access = access
        @hub_id = hub_id.presence&.to_i
      end

      def warehouses_scope
        scope = Warehouse.where(id: pluck_accessible_warehouse_ids).where.not(location_id: nil)
        scope = scope.where(hub_id: @hub_id) if federal_or_admin? && @hub_id.present? && @hub_id.positive?
        scope.order(:name)
      end

      def fdp_locations_scope
        if federal_or_admin?
          Cats::Core::Location.where(location_type: Cats::Core::Location::FDP).order(:name)
        else
          scope_ids = @access.officer_location_scope_ids
          return Cats::Core::Location.none if scope_ids.blank?

          Cats::Core::Location.where(id: scope_ids, location_type: Cats::Core::Location::FDP).order(:name)
        end
      end

      private

      def federal_or_admin?
        @access.admin? || @access.officer_full_access?
      end

      def pluck_accessible_warehouse_ids
        raw = @access.accessible_warehouse_ids
        if raw.is_a?(ActiveRecord::Relation)
          raw.pluck(:id)
        else
          Array(raw).map(&:to_i).reject(&:zero?)
        end
      end
    end
  end
end
