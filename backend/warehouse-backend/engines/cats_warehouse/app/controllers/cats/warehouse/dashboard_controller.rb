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

      # GET /v1/dashboard/warehouse_manager?warehouse_id=
      def warehouse_manager
        authorize :dashboard, :warehouse_manager?, policy_class: DashboardPolicy

        warehouse_id = params[:warehouse_id].to_i
        if warehouse_id <= 0
          return render_error("warehouse_id is required", status: :unprocessable_entity)
        end

        access = AccessContext.new(user: current_user)
        unless access.can_access_warehouse?(warehouse_id)
          return render_error("Access denied to warehouse #{warehouse_id}", status: :forbidden)
        end

        payload = WarehouseManagerDashboard.new(warehouse_id: warehouse_id).call

        render_success(payload)
      end
    end
  end
end
