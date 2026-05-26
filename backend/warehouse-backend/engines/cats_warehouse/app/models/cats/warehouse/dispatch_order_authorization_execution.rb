# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationExecution < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_authorization_executions"

      DRAFT = "draft"
      CONFIRMED = "confirmed"

      belongs_to :dispatch_order_authorization, class_name: "Cats::Warehouse::DispatchOrderAuthorization"
      belongs_to :dispatch_order_authorization_store, class_name: "Cats::Warehouse::DispatchOrderAuthorizationStore"
      belongs_to :storekeeper, class_name: "Cats::Core::User"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"

      has_many :dispatch_stack_allocations,
               class_name: "Cats::Warehouse::DispatchStackAllocation",
               dependent: :destroy

      validates :quantity, presence: true, numericality: { greater_than: 0 }
      validates :status, presence: true, inclusion: { in: [DRAFT, CONFIRMED] }
      validates :shortage_reason, presence: true, if: :shortage_requires_reason?

      def shortage_requires_reason?
        shortage_quantity.to_f.positive?
      end
    end
  end
end
