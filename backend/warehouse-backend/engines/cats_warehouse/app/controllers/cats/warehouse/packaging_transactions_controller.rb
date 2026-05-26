# frozen_string_literal: true

module Cats
  module Warehouse
    class PackagingTransactionsController < BaseController
      def index
        authorize PackagingTransaction
        scope = policy_scope(PackagingTransaction).order(occurred_at: :desc)
        scope = scope.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
        render_resource(scope.limit(100))
      end

      def create
        authorize PackagingTransaction
        payload = params.require(:payload).permit(
          :transaction_type, :warehouse_id, :commodity_id, :quantity, :unit_id,
          :packaging_unit_id, :packaging_size, :reference_order_type, :reference_order_id
        )

        warehouse = Warehouse.find(payload[:warehouse_id])
        commodity = Cats::Core::Commodity.find(payload[:commodity_id])
        reference = payload[:reference_order_type].constantize.find(payload[:reference_order_id])

        pt = PackagingTransactionPoster.new(
          actor: current_user,
          transaction_type: payload[:transaction_type],
          warehouse: warehouse,
          commodity: commodity,
          quantity: payload[:quantity],
          unit_id: payload[:unit_id],
          reference_order: reference,
          packaging_unit_id: payload[:packaging_unit_id],
          packaging_size: payload[:packaging_size]
        ).call

        render_success(id: pt.id, status: pt.status)
      end
    end
  end
end
