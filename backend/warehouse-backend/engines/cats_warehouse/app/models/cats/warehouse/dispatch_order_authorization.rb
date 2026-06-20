module Cats
  module Warehouse
    class DispatchOrderAuthorization < ApplicationRecord
      self.table_name = "cats_warehouse_dispatch_order_authorizations"

      # ── Status constants ──────────────────────────────────────────────────
      DRAFT     = "draft"
      CONFIRMED = "confirmed"
      CANCELLED = "cancelled"

      STATUSES = [DRAFT, CONFIRMED, CANCELLED].freeze

      # ── Associations ──────────────────────────────────────────────────────
      belongs_to :dispatch_order,  class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :warehouse,       class_name: "Cats::Warehouse::Warehouse"
      belongs_to :commodity,       class_name: "Cats::Core::Commodity", optional: true
      belongs_to :transporter,     class_name: "Cats::Core::Transporter", optional: true
      belongs_to :created_by,      class_name: "Cats::Core::User"
      belongs_to :confirmed_by,    class_name: "Cats::Core::User", optional: true,
                                   foreign_key: :confirmed_by_id
      belongs_to :driver_confirmed_by, class_name: "Cats::Core::User", optional: true,
                                       foreign_key: :driver_confirmed_by_id
      belongs_to :cancelled_by,    class_name: "Cats::Core::User", optional: true,
                                   foreign_key: :cancelled_by_id
      belongs_to :authorized_quantity_input_unit,
                 class_name: "Cats::Core::UnitOfMeasure",
                 optional: true,
                 foreign_key: :authorized_quantity_input_unit_id

      has_many :authorization_stores,
               class_name: "Cats::Warehouse::DispatchOrderAuthorizationStore",
               foreign_key: :dispatch_order_authorization_id,
               dependent: :destroy
      has_many :gins, class_name: "Cats::Warehouse::Gin",
               foreign_key: :dispatch_order_authorization_id, dependent: :nullify

      # ── Validations ───────────────────────────────────────────────────────
      validates :status,              presence: true, inclusion: { in: STATUSES }
      validates :authorized_quantity, presence: true, numericality: { greater_than: 0 }
      validates :driver_name,         presence: true
      validates :driver_id_number,    presence: true
      validates :truck_plate_number,  presence: true
      validates :reference_no,        uniqueness: true, allow_blank: true

      # ── Status helpers ────────────────────────────────────────────────────
      def draft?     = status == DRAFT
      def confirmed? = status == CONFIRMED
      def cancelled? = status == CANCELLED

      # Used by DispatchOrderAuthorizationSerializer.
      # Some deployments may not have a persisted column for `authorized_quantity_input`,
      # so we safely fall back to `authorized_quantity`.
      def authorized_quantity_input
        if self.class.column_names.include?("authorized_quantity_input")
          read_attribute(:authorized_quantity_input).to_f
        else
          authorized_quantity.to_f
        end
      end

      # ── Scopes ────────────────────────────────────────────────────────────
      scope :draft,     -> { where(status: DRAFT) }
      scope :confirmed, -> { where(status: CONFIRMED) }
      scope :cancelled, -> { where(status: CANCELLED) }
      scope :not_cancelled, -> { where.not(status: CANCELLED) }
    end
  end
end
