# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorization < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_authorizations"

      DRAFT = "draft"
      CONFIRMED = "confirmed"
      IN_PROGRESS = "in_progress"
      COMPLETED = "completed"
      CANCELLED = "cancelled"

      STATUSES = [DRAFT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED].freeze

      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :transporter, class_name: "Cats::Core::Transporter"
      belongs_to :authorized_quantity_input_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :created_by, class_name: "Cats::Core::User"
      belongs_to :confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :driver_confirmed_by, class_name: "Cats::Core::User", optional: true
      belongs_to :cancelled_by, class_name: "Cats::Core::User", optional: true

      has_many :dispatch_order_authorization_stores,
               class_name: "Cats::Warehouse::DispatchOrderAuthorizationStore",
               dependent: :destroy
      has_many :dispatch_order_authorization_executions,
               class_name: "Cats::Warehouse::DispatchOrderAuthorizationExecution",
               dependent: :destroy
      has_one :waybill, class_name: "Cats::Warehouse::Waybill", dependent: :nullify
      has_many :gins, class_name: "Cats::Warehouse::Gin", dependent: :nullify
      has_many :workflow_events, as: :entity, class_name: "Cats::Warehouse::WorkflowEvent", dependent: :destroy

      validates :status, presence: true, inclusion: { in: STATUSES }
      validates :authorized_quantity, presence: true, numericality: { greater_than: 0 }
      validates :reference_no, uniqueness: true, allow_blank: true

      def draft? = status == DRAFT
      def confirmed? = status == CONFIRMED
      def in_progress? = status == IN_PROGRESS
      def completed? = status == COMPLETED
      def cancelled? = status == CANCELLED
    end
  end
end
