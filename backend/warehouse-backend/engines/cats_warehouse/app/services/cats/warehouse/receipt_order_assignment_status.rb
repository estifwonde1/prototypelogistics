# frozen_string_literal: true

module Cats
  module Warehouse
    # Receipt order assignment row status — distinct from document (order) status.
    #
    # pending            → hub notified; no warehouse/store yet
    # warehouse_assigned → hub routed to warehouse, or independent warehouse received the order (no store yet)
    # assigned           → store allocation complete (independent warehouse must reach this before "assigned")
    module ReceiptOrderAssignmentStatus
      WAREHOUSE_ASSIGNED = "warehouse_assigned"
      PENDING = "pending"

      ALLOWED = %w[
        pending
        warehouse_assigned
        assigned
        accepted
        in_progress
        completed
        rejected
      ].freeze

      module_function

      def resolve(warehouse_id:, store_id:)
        return ContractConstants::DOCUMENT_STATUSES[:assigned] if store_id.present?
        return WAREHOUSE_ASSIGNED if warehouse_id.present?

        PENDING
      end

      def normalize(raw)
        return ContractConstants::DOCUMENT_STATUSES[:assigned] if raw.blank?

        key = raw.to_s.strip.downcase.tr(" ", "_")
        return key if ALLOWED.include?(key)

        ContractConstants::DOCUMENT_STATUSES[:assigned]
      end

      def standalone_warehouse?(warehouse_id)
        return false if warehouse_id.blank?

        Warehouse.where(id: warehouse_id, hub_id: nil).exists?
      end

      # Order-level "assigned" when every line has a sufficient assignment row.
      def line_operationally_assigned?(assignments_for_line)
        return false if assignments_for_line.blank?

        assignments_for_line.any? do |assignment|
          return true if assignment.store_id.present?

          next false if assignment.warehouse_id.blank?

          # Hub-affiliated warehouse allocation is enough for the order to advance.
          !standalone_warehouse?(assignment.warehouse_id)
        end
      end
    end
  end
end
