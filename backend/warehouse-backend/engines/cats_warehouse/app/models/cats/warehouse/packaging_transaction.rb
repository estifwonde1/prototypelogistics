# frozen_string_literal: true

module Cats
  module Warehouse
    class PackagingTransaction < ApplicationRecord
      self.table_name = "cats_warehouse_packaging_transactions"

      RECEIVE = "receive"
      DISPATCH = "dispatch"
      POSTED = "posted"
      VOIDED = "voided"

      TRANSACTION_TYPES = [RECEIVE, DISPATCH].freeze
      STATUSES = [POSTED, VOIDED].freeze

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :packaging_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :created_by, class_name: "Cats::Core::User"

      validates :transaction_type, inclusion: { in: TRANSACTION_TYPES }
      validates :status, inclusion: { in: STATUSES }
      validates :quantity, presence: true, numericality: { greater_than: 0 }
      validates :occurred_at, presence: true
      validates :reference_order_type, :reference_order_id, presence: true
    end
  end
end
