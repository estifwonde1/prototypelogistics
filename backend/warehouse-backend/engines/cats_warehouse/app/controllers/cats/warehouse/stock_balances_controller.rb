module Cats
  module Warehouse
    class StockBalancesController < BaseController
      def index
        authorize StockBalance
        balances = policy_scope(StockBalance)
                     .includes(:warehouse, :store, :stack, :commodity, :unit, :inventory_lot)
                     .order(:id)

        balances = balances.where(stack_id: params[:stack_id])        if params[:stack_id].present?
        balances = balances.where(store_id: params[:store_id])        if params[:store_id].present?
        balances = balances.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
        balances = balances.where(commodity_id: params[:commodity_id]) if params[:commodity_id].present?

        render_resource(balances, each_serializer: StockBalanceSerializer)
      end

      def show
        balance = policy_scope(StockBalance).find(params[:id])
        authorize balance
        render_resource(balance, serializer: StockBalanceSerializer)
      end
    end
  end
end
