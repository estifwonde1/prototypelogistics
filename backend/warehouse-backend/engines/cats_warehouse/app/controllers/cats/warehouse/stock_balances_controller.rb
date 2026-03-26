module Cats
  module Warehouse
    class StockBalancesController < BaseController
      def index
        authorize StockBalance
        render_resource(policy_scope(StockBalance).order(:id), each_serializer: StockBalanceSerializer)
      end

      def show
        balance = policy_scope(StockBalance).find(params[:id])
        authorize balance
        render_resource(balance, serializer: StockBalanceSerializer)
      end
    end
  end
end
