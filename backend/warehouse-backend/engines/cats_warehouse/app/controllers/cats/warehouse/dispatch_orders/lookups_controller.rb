# frozen_string_literal: true

module Cats
  module Warehouse
    module DispatchOrders
      class LookupsController < BaseController
        skip_after_action :verify_authorized, only: [:source_warehouses, :destinations]

        def source_warehouses
          authorize DispatchOrder, :create?

          scope = Warehouse.where(id: AccessContext.new(user: current_user).accessible_warehouse_ids)
          scope = apply_search(scope, %w[name code])
          render_lookup_page(scope)
        end

        def destinations
          authorize DispatchOrder, :create?

          access = AccessContext.new(user: current_user)
          location_ids = access.admin? || access.officer_full_access? ? nil : access.officer_location_scope_ids

          scope = Cats::Core::Location.where(location_type: [Cats::Core::Location::WAREHOUSE, Cats::Core::Location::FDP])
          scope = scope.where(id: location_ids) if location_ids.present?

          if ActiveModel::Type::Boolean.new.cast(params[:exchange_only])
            scope = scope.where(location_type: Cats::Core::Location::WAREHOUSE)
          end

          scope = apply_search(scope, %w[name code])
          render_lookup_page(scope)
        end

        private

        def apply_search(scope, columns)
          return scope unless params[:q].present?

          q = "%#{params[:q].to_s.strip}%"
          conditions = columns.map { |col| "#{scope.table_name}.#{col} ILIKE ?" }.join(" OR ")
          scope.where(conditions, *([q] * columns.length))
        end

        def render_lookup_page(scope)
          page = [params[:page].to_i, 1].max
          per_page = [[params[:per_page].to_i, 25].max, 100].min
          total = scope.count
          items = scope.offset((page - 1) * per_page).limit(per_page)

          render_success(
            items: ActiveModelSerializers::SerializableResource.new(items, each_serializer: LookupOptionSerializer).as_json,
            meta: { page: page, per_page: per_page, total_count: total }
          )
        end
      end
    end
  end
end
