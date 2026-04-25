# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequest < ApplicationRecord
      self.table_name = "cats_warehouse_transfer_requests"

      STATUSES = %w[Pending Approved Rejected Completed].freeze

      belongs_to :source_store, class_name: "Cats::Warehouse::Store"
      belongs_to :destination_store, class_name: "Cats::Warehouse::Store"
      belongs_to :source_stack, class_name: "Cats::Warehouse::Stack"
      belongs_to :destination_stack, class_name: "Cats::Warehouse::Stack", optional: true
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"
      belongs_to :requested_by, class_name: "Cats::Core::User"
      belongs_to :reviewed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      validates :quantity, presence: true, numericality: { greater_than: 0 }
      validates :status, presence: true, inclusion: { in: STATUSES }
      validate :stores_in_same_warehouse
      validate :sufficient_source_quantity, on: :create

      scope :pending, -> { where(status: "Pending") }
      scope :approved, -> { where(status: "Approved") }
      scope :rejected, -> { where(status: "Rejected") }
      scope :completed, -> { where(status: "Completed") }

      def approve!(reviewed_by_user, destination_stack_id: nil, notes: nil)
        raise "Request is not pending" unless status == "Pending"

        self.status = "Approved"
        self.reviewed_by = reviewed_by_user
        self.reviewed_at = Time.current
        self.review_notes = notes
        self.destination_stack_id = destination_stack_id if destination_stack_id.present?
        save!
      end

      def reject!(reviewed_by_user, notes:)
        raise "Request is not pending" unless status == "Pending"

        self.status = "Rejected"
        self.reviewed_by = reviewed_by_user
        self.reviewed_at = Time.current
        self.review_notes = notes
        save!
      end

      def complete!
        raise "Request is not approved" unless status == "Approved"

        self.status = "Completed"
        save!
      end

      private

      def stores_in_same_warehouse
        return unless source_store.present? && destination_store.present?

        if source_store.warehouse_id != destination_store.warehouse_id
          errors.add(:base, "Source and destination stores must be in the same warehouse")
        end

        if source_store_id == destination_store_id
          errors.add(:base, "Source and destination stores must be different")
        end
      end

      def sufficient_source_quantity
        return unless source_stack.present? && quantity.present?

        if source_stack.quantity < quantity
          errors.add(:quantity, "exceeds available quantity in source stack (#{source_stack.quantity})")
        end
      end
    end
  end
end
