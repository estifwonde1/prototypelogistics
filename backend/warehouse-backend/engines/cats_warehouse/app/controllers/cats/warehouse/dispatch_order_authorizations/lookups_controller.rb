# frozen_string_literal: true

module Cats
  module Warehouse
    module DispatchOrderAuthorizations
      class LookupsController < BaseController
        include OfficerDispatchV2Feature

        before_action :ensure_officer_dispatch_v2_enabled!

        def stores
          authorize DispatchOrderAuthorization, :stores?
          raise ArgumentError, "warehouse_id is required" if params[:warehouse_id].blank?

          warehouse = Warehouse.find(params[:warehouse_id])
          access = AccessContext.new(user: current_user)
          wh_ids = access.accessible_warehouse_ids
          wh_list = wh_ids.is_a?(ActiveRecord::Relation) ? wh_ids.pluck(:id) : Array(wh_ids).map(&:to_i)
          unless access.admin? || wh_list.include?(warehouse.id.to_i)
            raise Pundit::NotAuthorizedError
          end

          scope = warehouse.stores
          scope = scope.where("name ILIKE ?", "%#{params[:q]}%") if params[:q].present?

          render_success(
            items: scope.map { |s| { id: s.id, name: s.name, code: s.code, label: "#{s.name} (#{s.code})" } }
          )
        end

        def stacks
          authorize DispatchOrderAuthorization, :stacks?
          raise ArgumentError, "store_id and commodity_id are required" if params[:store_id].blank? || params[:commodity_id].blank?

          store = Store.find(params[:store_id])
          access = AccessContext.new(user: current_user)
          unless access.admin? || Array(access.accessible_store_ids).map(&:to_i).include?(store.id.to_i)
            raise Pundit::NotAuthorizedError
          end

          commodity_id = params[:commodity_id].to_i
          commodity_ids = CommodityDefinitionStockResolver.core_commodity_ids_for_core_commodity(commodity_id)

          balances = StockBalance
            .includes(:unit, :stack, :commodity)
            .where(store_id: store.id, commodity_id: commodity_ids)
            .where.not(stack_id: nil)
            .where("COALESCE(available_quantity, quantity) > ?", 0.0001)

          items = balances.filter_map do |balance|
            stack = balance.stack
            next if stack.blank?

            available_qty = (balance.available_quantity || balance.quantity).to_f
            next if available_qty <= 0.0001

            unit = balance.unit || stack.unit
            display_name = stack.code.presence || "Stack #{stack.id}"
            batch_no = balance.commodity&.batch_no
            batch_suffix = batch_no.present? ? " · #{batch_no}" : ""

            {
              id: stack.id,
              store_id: stack.store_id,
              commodity_id: balance.commodity_id,
              name: display_name,
              code: stack.code,
              label: "#{display_name}#{batch_suffix}",
              available_quantity: available_qty,
              unit_id: unit&.id,
              unit_name: unit&.abbreviation.presence || unit&.name,
              base_quantity: (balance.base_quantity || stack.base_quantity).to_f
            }
          end

          # De-dupe when multiple balance rows exist for the same stack + commodity (e.g. lots)
          items = items
            .group_by { |row| [row[:id], row[:commodity_id]] }
            .map do |_key, rows|
              row = rows.first.dup
              row[:available_quantity] = rows.sum { |r| r[:available_quantity].to_f }
              row
            end
            .sort_by { |row| row[:label].to_s.downcase }

          render_success(items: items)
        end
      end
    end
  end
end
