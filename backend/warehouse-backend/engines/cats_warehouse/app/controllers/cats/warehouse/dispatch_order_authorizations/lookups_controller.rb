# frozen_string_literal: true

module Cats
  module Warehouse
    module DispatchOrderAuthorizations
      class LookupsController < BaseController
        def stores
          authorize DispatchOrderAuthorization
          raise ArgumentError, "warehouse_id is required" if params[:warehouse_id].blank?

          warehouse = Warehouse.find(params[:warehouse_id])
          scope = warehouse.stores
          scope = scope.where("name ILIKE ?", "%#{params[:q]}%") if params[:q].present?

          render_success(
            items: scope.map { |s| { id: s.id, name: s.name, code: s.code, label: "#{s.name} (#{s.code})" } }
          )
        end

        def stacks
          authorize DispatchOrderAuthorization
          raise ArgumentError, "store_id and commodity_id are required" if params[:store_id].blank? || params[:commodity_id].blank?

          stacks = Stack.where(store_id: params[:store_id], commodity_id: params[:commodity_id])
          items = stacks.map do |stack|
            balance = StockBalance.find_by(stack_id: stack.id, commodity_id: params[:commodity_id])
            {
              id: stack.id,
              name: stack.name,
              code: stack.code,
              label: "#{stack.name} (#{stack.code})",
              available_quantity: balance&.quantity.to_f
            }
          end

          render_success(items: items)
        end
      end
    end
  end
end
