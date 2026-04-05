module Cats
  module Warehouse
    class StockBalancesController < BaseController
      def index
        authorize StockBalance
        balances = policy_scope(StockBalance).includes(:warehouse, :store, :stack, :commodity, :unit).order(:id)
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
