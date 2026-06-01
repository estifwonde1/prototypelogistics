module Cats
  module Warehouse
    class DashboardController < BaseController
      skip_after_action :verify_authorized

      # GET /v1/dashboard/officer
      # Returns lightweight count aggregates for the officer dashboard.
      # Avoids loading full nested payloads for hubs, warehouses, orders.
      def officer
        render_success(
          hubs_count:      policy_scope(Hub).count,
          warehouses_count: policy_scope(Warehouse).count,
          receipt_orders:  policy_scope(ReceiptOrder).group(:status).count,
          dispatch_orders: policy_scope(DispatchOrder).group(:status).count
        )
      end
    end
  end
end
