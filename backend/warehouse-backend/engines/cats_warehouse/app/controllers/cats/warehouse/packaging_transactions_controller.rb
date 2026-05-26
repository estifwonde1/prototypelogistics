# frozen_string_literal: true

module Cats
  module Warehouse
    class PackagingTransactionsController < BaseController
      def index
        authorize PackagingTransaction
        scope = policy_scope(PackagingTransaction).order(occurred_at: :desc)
        scope = scope.where(warehouse_id: params[:warehouse_id]) if params[:warehouse_id].present?
        scope = scope.where(transaction_type: params[:transaction_type]) if params[:transaction_type].present?
        scope = scope.where(reference_order_type: params[:reference_order_type], reference_order_id: params[:reference_order_id]) if params[:reference_order_id].present?
        render_resource(scope.limit(100), each_serializer: PackagingTransactionSerializer)
      end

      def show
        pt = policy_scope(PackagingTransaction).find(params[:id])
        authorize pt
        render_resource(pt, serializer: PackagingTransactionSerializer)
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

        render_resource(pt, serializer: PackagingTransactionSerializer, status: :created)
      end

      def void
        pt = policy_scope(PackagingTransaction).find(params[:id])
        authorize pt, :void?

        raise ArgumentError, "Only posted transactions can be voided" unless pt.status == PackagingTransaction::POSTED

        PackagingTransaction.transaction do
          pt.update!(status: PackagingTransaction::VOIDED)

          # Record audit event on the reference order if it supports workflow events
          if pt.reference_order.present? && pt.reference_order.respond_to?(:workflow_events)
            WorkflowEventRecorder.record!(
              entity: pt.reference_order,
              event_type: "packaging_transaction.voided",
              actor: current_user,
              from_status: nil,
              to_status: nil,
              payload: { packaging_transaction_id: pt.id }
            )
          end
        end

        render_resource(pt.reload, serializer: PackagingTransactionSerializer)
      end
    end
  end
end
