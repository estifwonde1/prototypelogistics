module Cats
  module Warehouse
    class StockBalancesController < BaseController
      def index
        authorize StockBalance
        render_resource(scoped_balances.order(:id), each_serializer: StockBalanceSerializer)
      end

      def show
        balance = scoped_balances.find(params[:id])
        authorize balance
        render_resource(balance, serializer: StockBalanceSerializer)
      end

      private

      def scoped_balances
        return StockBalance.all if admin_user?

        if hub_manager?
          hub_warehouse_ids = warehouses_for_hubs(assigned_hub_ids)
          store_ids = stores_for_warehouses(hub_warehouse_ids)
          stack_ids = stacks_for_stores(store_ids)
          return StockBalance.where(stack_id: stack_ids).or(StockBalance.where(store_id: store_ids))
        end

        if warehouse_manager?
          store_ids = stores_for_warehouses(assigned_warehouse_ids)
          stack_ids = stacks_for_stores(store_ids)
          return StockBalance.where(stack_id: stack_ids).or(StockBalance.where(store_id: store_ids))
        end

        if storekeeper?
          stack_ids = stacks_for_stores(assigned_store_ids)
          return StockBalance.where(stack_id: stack_ids).or(StockBalance.where(store_id: assigned_store_ids))
        end

        StockBalance.none
      end
    end
  end
end
