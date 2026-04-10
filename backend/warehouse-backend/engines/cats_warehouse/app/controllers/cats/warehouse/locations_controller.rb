module Cats
  module Warehouse
    class LocationsController < BaseController
      ETHIOPIA_REGION_NAMES = [
        "Tigray",
        "Afar",
        "Amhara",
        "Oromia",
        "Somali",
        "Benishangul-Gumuz",
        "Gambella",
        "Southern Nations Nationalities and People Region (SNNPR)",
        "Harari",
        "South West Ethiopia Peoples' Region (SWEPR)",
        "Addis Ababa",
        "Dire Dawa"
      ].freeze

      before_action :require_admin!
      skip_after_action :verify_authorized, raise: false

      def regions
        locations = Cats::Core::Location.where(
          location_type: Cats::Core::Location::REGION,
          name: ETHIOPIA_REGION_NAMES
        ).to_a.sort_by { |location| ETHIOPIA_REGION_NAMES.index(location.name) || ETHIOPIA_REGION_NAMES.length }
        render_success(locations: locations.map { |l| location_payload(l) })
      end

      def zones
        region = params[:region_id].present? ? Cats::Core::Location.find(params[:region_id]) : nil
        zones = Cats::Core::Location.where(
          location_type: Cats::Core::Location::ZONE
        )
        zones = zones.where(ancestry: region.id.to_s) if region
        zones = zones.order(:name)
        render_success(locations: zones.map { |l| location_payload(l) })
      end

      def woredas
        zone = Cats::Core::Location.find(params[:zone_id])
        woredas = Cats::Core::Location.where(
          ancestry: child_ancestry_for(zone),
          location_type: Cats::Core::Location::WOREDA
        ).order(:id)
        render_success(locations: woredas.map { |l| location_payload(l) })
      end

      def create
        payload = params.require(:payload).permit(:name, :code, :location_type, :parent_id)
        parent = payload[:parent_id].present? ? Cats::Core::Location.find(payload[:parent_id]) : nil
        location = Cats::Core::Location.create!(
          name: payload[:name],
          code: payload[:code],
          location_type: payload[:location_type],
          ancestry: parent ? child_ancestry_for(parent) : nil
        )
        render_success({ location: location_payload(location) }, status: :created)
      end

      def hubs
        hubs = Cats::Warehouse::Hub.order(:id)
        render_success(locations: hubs.map { |h| location_payload(h.location).merge(id: h.id, name: h.name) })
      end

      def warehouses
        scope = Cats::Warehouse::Warehouse.order(:id)
        scope = scope.where(hub_id: params[:hub_id]) if params[:hub_id].present?
        render_success(locations: scope.map { |w| location_payload(w.location).merge(id: w.id, name: w.name) })
      end

      def stores
        scope = Cats::Warehouse::Store.order(:id)
        scope = scope.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
        render_success(locations: scope.map { |s| { id: s.id, name: s.name, warehouse_id: s.warehouse_id } })
      end

      private

      def location_payload(location)
        { id: location.id, name: location.name, code: location.code, parent_id: parent_id_for(location) }
      end

      def parent_id_for(location)
        ancestry = location.ancestry
        return nil if ancestry.blank?

        ancestry.split("/").last.to_i
      end

      def child_ancestry_for(parent)
        return parent.id.to_s if parent.ancestry.blank?

        "#{parent.ancestry}/#{parent.id}"
      end

      def require_admin!
        return if current_user&.has_role?("Admin") || current_user&.has_role?("Superadmin")

        render_error("Not authorized", status: :forbidden)
      end
    end
  end
end
