# frozen_string_literal: true

module Cats
  module Warehouse
    module DispatchOrders
      class LookupsController < BaseController
        include OfficerDispatchV2Feature
        include LookupPagination

        before_action :ensure_officer_dispatch_v2_enabled!
        skip_after_action :verify_authorized, only: [:source_warehouses, :destinations, :warehouses_for_commodity]

        def source_warehouses
          authorize DispatchOrder, :create?

          scope = Warehouse.where(id: AccessContext.new(user: current_user).accessible_warehouse_ids)
          render_paginated_lookup(scope, search_columns: %w[name code])
        end

        def destinations
          authorize DispatchOrder, :create?

          access = AccessContext.new(user: current_user)
          hub_id = params[:hub_id] if access.admin? || access.officer_full_access?

          items = DispatchDestinationLookupItems.call(
            access: access,
            destination_kind: resolve_destination_kind,
            hub_id: hub_id,
            query: params[:q]
          )

          render_paginated_array(items)
        end

        # Warehouses in officer scope with aggregated stock for an admin commodity definition (all batches).
        def warehouses_for_commodity
          authorize DispatchOrder, :create?

          definition = resolve_commodity_definition_for_lookup!
          commodity_ids = CommodityDefinitionStockResolver.core_commodity_ids_for_definition(definition)

          display_unit_id =
            if params[:unit_id].present?
              params[:unit_id].to_i
            else
              CommodityDefinitionStockResolver.default_unit_id_for_definition(definition)
            end

          access = AccessContext.new(user: current_user)
          warehouse_ids = access.accessible_warehouse_ids
          warehouse_ids = warehouse_ids.pluck(:id) if warehouse_ids.is_a?(ActiveRecord::Relation)
          warehouse_ids = Array(warehouse_ids).map(&:to_i).uniq.reject(&:zero?)

          availability = DispatchStockAvailability.new(
            commodity_definition_id: definition.id,
            warehouse_ids: warehouse_ids
          )

          per_wh = availability.available_base_quantity_per_warehouse
          base_unit_id = availability.base_unit_id
          conversion_commodity_id = availability.conversion_commodity_id

          warehouses_by_id = Warehouse.where(id: per_wh.keys).index_by(&:id)

          items = []
          per_wh.each do |wid, base_qty|
            next if base_qty.to_f <= 0

            wh = warehouses_by_id[wid]
            next unless wh

            display_qty =
              if base_unit_id.blank? || display_unit_id.to_i == base_unit_id.to_i
                base_qty.to_f
              else
                UomConversionResolver.convert(
                  base_qty,
                  from_unit_id: base_unit_id,
                  to_unit_id: display_unit_id,
                  commodity_id: conversion_commodity_id
                )
              end

            row = ActiveModelSerializers::SerializableResource.new(wh, serializer: LookupOptionSerializer).as_json
            row[:meta] = {
              commodity_definition_id: definition.id,
              commodity_id: conversion_commodity_id,
              available_quantity: display_qty.to_f.round(3),
              unit_id: display_unit_id
            }
            items << row
          end

          items.sort_by! { |it| it[:label].to_s.downcase }

          total_available_quantity = items.sum { |it| it[:meta][:available_quantity].to_f }.round(3)
          display_unit = display_unit_id.present? ? Cats::Core::UnitOfMeasure.find_by(id: display_unit_id) : nil

          render_success(
            items: items,
            meta: {
              commodity_definition_id: definition.id,
              commodity_name: definition.name,
              commodity_ids: commodity_ids,
              unit_id: display_unit_id,
              unit_abbreviation: display_unit&.abbreviation.presence || display_unit&.name,
              total_available_quantity: total_available_quantity,
              total_count: items.size,
              has_inventory_lots: commodity_ids.any?
            }
          )
        end

        def resolve_commodity_definition_for_lookup!
          if params[:commodity_definition_id].present?
            return CommodityDefinition.find(params[:commodity_definition_id])
          end

          if params[:commodity_id].present?
            commodity = Cats::Core::Commodity.find(params[:commodity_id])
            definition = CommodityDefinitionStockResolver.definition_for_core_commodity(commodity)
            return definition if definition.present?

            label = CommodityDefinitionStockResolver.core_commodity_catalog_name(commodity)
            raise ArgumentError, "No admin commodity definition matches #{label}"
          end

          raise ActionController::ParameterMissing, :commodity_definition_id
        end

        def resolve_destination_kind
          return "warehouse" if ActiveModel::Type::Boolean.new.cast(params[:exchange_only])

          kind = params[:destination_kind].to_s.strip.downcase
          DispatchDestinationLookupItems::KINDS.include?(kind) ? kind : "all"
        end

        def render_paginated_array(items)
          page = [params[:page].to_i, 1].max
          per_page = params[:per_page].present? ? [[params[:per_page].to_i, 1].max, 100].min : 25
          total = items.size
          offset = (page - 1) * per_page
          page_items = items.slice(offset, per_page) || []

          render_success(
            items: page_items,
            meta: { page: page, per_page: per_page, total_count: total }
          )
        end

        private :resolve_commodity_definition_for_lookup!, :resolve_destination_kind, :render_paginated_array
      end
    end
  end
end
