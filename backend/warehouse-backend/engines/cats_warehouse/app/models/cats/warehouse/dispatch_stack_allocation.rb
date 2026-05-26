# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchStackAllocation < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_stack_allocations"

      belongs_to :dispatch_order_authorization_execution,
                 class_name: "Cats::Warehouse::DispatchOrderAuthorizationExecution",
                 optional: true
      belongs_to :gin, class_name: "Cats::Warehouse::Gin", optional: true
      belongs_to :stack, class_name: "Cats::Warehouse::Stack"

      validates :quantity, presence: true, numericality: { greater_than: 0 }
    end
  end
end
