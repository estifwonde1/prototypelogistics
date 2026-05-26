# frozen_string_literal: true

module Cats
  module Warehouse
    # Nightly reconciliation: packaging transaction totals vs GIN items vs authorization executions.
    class PackagingReconciliationJob < ApplicationJob
      queue_as :default

      def perform(since: 7.days.ago)
        discrepancies = []

        PackagingTransaction.where(status: PackagingTransaction::POSTED).where("occurred_at >= ?", since).find_each do |pt|
          next unless pt.reference_order_type == "Cats::Warehouse::DispatchOrder"

          order = DispatchOrder.find_by(id: pt.reference_order_id)
          next if order.blank?

          gin_total = Gin.joins(:gin_items)
            .where(dispatch_order_id: order.id, status: ContractConstants::DOCUMENT_STATUSES[:confirmed])
            .sum("cats_warehouse_gin_items.base_quantity")
            .to_f

          pt_total = PackagingTransaction
            .where(reference_order_type: pt.reference_order_type, reference_order_id: pt.reference_order_id, status: PackagingTransaction::POSTED)
            .sum(:base_quantity)
            .to_f

          next if (pt_total - gin_total).abs <= 0.01

          discrepancies << {
            dispatch_order_id: order.id,
            packaging_base_total: pt_total,
            gin_confirmed_base_total: gin_total,
            delta: pt_total - gin_total
          }
        end

        if discrepancies.any?
          Rails.logger.warn("[PackagingReconciliationJob] #{discrepancies.size} discrepancies found")
          discrepancies.first(50).each do |row|
            Rails.logger.warn("[PackagingReconciliationJob] #{row.inspect}")
          end
        end

        discrepancies
      end
    end
  end
end
