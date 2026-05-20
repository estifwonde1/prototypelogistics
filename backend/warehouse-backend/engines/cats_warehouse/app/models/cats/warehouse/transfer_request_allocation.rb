# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestAllocation < ApplicationRecord
      self.table_name = "cats_warehouse_transfer_request_allocations"

      ACTIONS = %w[fulfillment rejection].freeze

      belongs_to :transfer_request, class_name: "Cats::Warehouse::TransferRequest"
      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :destination_stack, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :stack_transaction, class_name: "Cats::Warehouse::StackTransaction", optional: true
      belongs_to :reviewed_by, class_name: "Cats::Core::User"

      validates :action, presence: true, inclusion: { in: ACTIONS }
      validates :quantity, presence: true, numericality: { greater_than: 0 }
    end
  end
end
