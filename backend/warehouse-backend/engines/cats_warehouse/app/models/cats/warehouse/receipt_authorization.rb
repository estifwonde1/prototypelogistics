module Cats
  module Warehouse
    class ReceiptAuthorization < ApplicationRecord
      self.table_name = "cats_warehouse_receipt_authorizations"

      # ── Status constants ──────────────────────────────────────────────────
      PENDING   = "pending"
      ACTIVE    = "active"
      CLOSED    = "closed"
      CANCELLED = "cancelled"

      STATUSES = [PENDING, ACTIVE, CLOSED, CANCELLED].freeze

      # ── Associations ──────────────────────────────────────────────────────
      belongs_to :receipt_order,            class_name: "Cats::Warehouse::ReceiptOrder"
      belongs_to :receipt_order_assignment, class_name: "Cats::Warehouse::ReceiptOrderAssignment", optional: true
      belongs_to :store,                    class_name: "Cats::Warehouse::Store"
      belongs_to :warehouse,                class_name: "Cats::Warehouse::Warehouse"
      belongs_to :transporter,              class_name: "Cats::Core::Transporter"
      belongs_to :created_by,               class_name: "Cats::Core::User"
      belongs_to :driver_confirmed_by,      class_name: "Cats::Core::User", optional: true,
                                            foreign_key: :driver_confirmed_by_id
      belongs_to :cancelled_by,             class_name: "Cats::Core::User", optional: true,
                                            foreign_key: :cancelled_by_id

      has_one :inspection, class_name: "Cats::Warehouse::Inspection",
              foreign_key: :receipt_authorization_id, dependent: :nullify
      has_one :grn, class_name: "Cats::Warehouse::Grn",
              foreign_key: :receipt_authorization_id, dependent: :nullify

      # ── Validations ───────────────────────────────────────────────────────
      validates :status,              presence: true, inclusion: { in: STATUSES }
      validates :authorized_quantity, presence: true, numericality: { greater_than: 0 }
      validates :driver_name,         presence: true
      validates :driver_id_number,    presence: true
      validates :truck_plate_number,  presence: true
      validates :waybill_number,      presence: true
      validates :reference_no,        uniqueness: true, allow_blank: true

      # ── Status helpers ────────────────────────────────────────────────────
      def pending?   = status == PENDING
      def active?    = status == ACTIVE
      def closed?    = status == CLOSED
      def cancelled? = status == CANCELLED

      # ── Scopes ────────────────────────────────────────────────────────────
      scope :pending,   -> { where(status: PENDING) }
      scope :active,    -> { where(status: ACTIVE) }
      scope :closed,    -> { where(status: CLOSED) }
      scope :cancelled, -> { where(status: CANCELLED) }
      scope :not_cancelled, -> { where.not(status: CANCELLED) }
    end
  end
end
