# frozen_string_literal: true



module Cats

  module Warehouse

    class TransferRequest < ApplicationRecord

      self.table_name = "cats_warehouse_transfer_requests"



      STATUSES = %w[Pending Approved Rejected Completed].freeze

      QTY_EPSILON = 0.001



      belongs_to :source_store, class_name: "Cats::Warehouse::Store"

      belongs_to :destination_store, class_name: "Cats::Warehouse::Store"

      belongs_to :source_stack, class_name: "Cats::Warehouse::Stack"

      belongs_to :destination_stack, class_name: "Cats::Warehouse::Stack", optional: true

      belongs_to :commodity, class_name: "Cats::Core::Commodity"

      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      belongs_to :entered_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      belongs_to :requested_by, class_name: "Cats::Core::User"

      belongs_to :reviewed_by, class_name: "Cats::Core::User", optional: true

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"



      has_many :allocations,

               class_name: "Cats::Warehouse::TransferRequestAllocation",

               foreign_key: :transfer_request_id,

               dependent: :destroy



      validates :quantity, presence: true, numericality: { greater_than: 0 }

      validates :status, presence: true, inclusion: { in: STATUSES }

      validate :stores_in_same_warehouse

      validate :sufficient_source_quantity, on: :create

      validate :allocation_totals_within_requested, if: :persisted?



      scope :pending, -> { where(status: "Pending") }

      scope :approved, -> { where(status: "Approved") }

      scope :rejected, -> { where(status: "Rejected") }

      scope :completed, -> { where(status: "Completed") }



      def open?

        status == "Pending" && remaining_quantity > QTY_EPSILON

      end



      def remaining_quantity

        [quantity.to_f - fulfilled_quantity.to_f - rejected_quantity.to_f, 0].max

      end



      def allocated_quantity

        fulfilled_quantity.to_f + rejected_quantity.to_f

      end



      def record_fulfillment!(amount, reviewed_by_user:, notes: nil, destination_stack_id: nil)

        raise "Request is not open" unless open?



        amt = amount.to_f

        raise ArgumentError, "Fulfillment quantity must be greater than zero" if amt <= 0

        if amt > remaining_quantity + QTY_EPSILON

          raise ArgumentError,

                "Fulfillment quantity (#{amt}) exceeds remaining (#{remaining_quantity})"

        end



        self.fulfilled_quantity = fulfilled_quantity.to_f + amt

        self.reviewed_by ||= reviewed_by_user

        self.reviewed_at ||= Time.current

        self.review_notes = notes if notes.present?

        self.destination_stack_id = destination_stack_id if destination_stack_id.present?

        save!

        close_if_fully_allocated!

      end



      def record_rejection!(amount, reviewed_by_user:, notes:)

        raise "Request is not open" unless open?

        raise ArgumentError, "Rejection notes are required" if notes.blank?



        amt = amount.to_f

        raise ArgumentError, "Rejection quantity must be greater than zero" if amt <= 0

        if amt > remaining_quantity + QTY_EPSILON

          raise ArgumentError,

                "Rejection quantity (#{amt}) exceeds remaining (#{remaining_quantity})"

        end



        self.rejected_quantity = rejected_quantity.to_f + amt

        self.reviewed_by = reviewed_by_user

        self.reviewed_at = Time.current

        self.review_notes = notes

        save!

        close_if_fully_allocated!

      end



      def reject_all!(reviewed_by_user, notes:)

        raise "Request is not open" unless open?

        raise ArgumentError, "Rejection notes are required" if notes.blank?



        if fulfilled_quantity.to_f > QTY_EPSILON

          record_rejection!(remaining_quantity, reviewed_by_user: reviewed_by_user, notes: notes)

        else

          self.status = "Rejected"

          self.rejected_quantity = quantity

          self.reviewed_by = reviewed_by_user

          self.reviewed_at = Time.current

          self.review_notes = notes

          save!

        end

      end



      def close_if_fully_allocated!

        return unless remaining_quantity <= QTY_EPSILON

        if reserved_quantity.to_f > QTY_EPSILON
          TransferRequestStockHold.release!(self, reserved_quantity)
        end

        if fulfilled_quantity.to_f > QTY_EPSILON

          self.status = "Completed"

        else

          self.status = "Rejected"

        end

        save!

      end



      # Legacy helpers kept for compatibility; partial flow stays Pending until closed.

      def approve!(reviewed_by_user, destination_stack_id: nil, notes: nil)

        unless open?

          raise "Request is not pending (current status: #{status}). This request may have already been processed."

        end



        self.reviewed_by ||= reviewed_by_user

        self.reviewed_at ||= Time.current

        self.review_notes = notes if notes.present?

        self.destination_stack_id = destination_stack_id if destination_stack_id.present?

        save!

      end



      def reject!(reviewed_by_user, notes:)

        reject_all!(reviewed_by_user, notes: notes)

      end



      def complete!

        close_if_fully_allocated!

        raise "Request is not fully allocated" unless status == "Completed"

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



      def allocation_totals_within_requested

        return unless quantity.present?



        if allocated_quantity > quantity.to_f + QTY_EPSILON

          errors.add(:base, "Fulfilled and rejected totals cannot exceed requested quantity")

        end

      end

    end

  end

end

