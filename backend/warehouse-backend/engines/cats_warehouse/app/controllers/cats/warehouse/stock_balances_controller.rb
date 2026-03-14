module Cats
  module Warehouse
    class StockBalancesController < BaseController
      def index
        authorize StockBalance
        render_resource(StockBalance.order(:id), each_serializer: StockBalanceSerializer)
      end

      def show
        balance = StockBalance.find(params[:id])
        authorize balance
        render_resource(balance, serializer: StockBalanceSerializer)
      end
    end
  end
end
