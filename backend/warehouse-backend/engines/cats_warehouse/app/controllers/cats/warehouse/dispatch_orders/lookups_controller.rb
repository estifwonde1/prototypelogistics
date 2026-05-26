# frozen_string_literal: true

module Cats
  module Warehouse
    module DispatchOrders
      class LookupsController < BaseController
        include OfficerDispatchV2Feature
        include LookupPagination

        before_action :ensure_officer_dispatch_v2_enabled!
        skip_after_action :verify_authorized, only: [:source_warehouses, :destinations]

        def source_warehouses
          authorize DispatchOrder, :create?

          scope = Warehouse.where(id: AccessContext.new(user: current_user).accessible_warehouse_ids)
          render_paginated_lookup(scope, search_columns: %w[name code])
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

          render_paginated_lookup(scope, search_columns: %w[name code])
        end
      end
    end
  end
end
