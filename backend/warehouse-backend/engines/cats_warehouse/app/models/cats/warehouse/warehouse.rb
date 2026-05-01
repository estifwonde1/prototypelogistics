module Cats
  module Warehouse
    class Warehouse < ApplicationRecord
      self.table_name = "cats_warehouse_warehouses"

      belongs_to :location, class_name: "Cats::Core::Location"
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :geo, class_name: "Cats::Warehouse::Geo", optional: true

      has_one_attached :rental_agreement_document

      has_one :warehouse_capacity, class_name: "Cats::Warehouse::WarehouseCapacity", dependent: :destroy
      has_one :warehouse_access, class_name: "Cats::Warehouse::WarehouseAccess", dependent: :destroy
      has_one :warehouse_infra, class_name: "Cats::Warehouse::WarehouseInfra", dependent: :destroy
      has_one :warehouse_contacts, class_name: "Cats::Warehouse::WarehouseContacts", dependent: :destroy

      has_many :stores, class_name: "Cats::Warehouse::Store", dependent: :destroy
      has_many :stacking_rules, class_name: "Cats::Warehouse::StackingRule", dependent: :destroy
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy
      has_many :grns, class_name: "Cats::Warehouse::Grn", dependent: :destroy
      has_many :gins, class_name: "Cats::Warehouse::Gin", dependent: :destroy
      has_many :inspections, class_name: "Cats::Warehouse::Inspection", dependent: :destroy
      has_many :receipt_orders, class_name: "Cats::Warehouse::ReceiptOrder", dependent: :nullify
      has_many :dispatch_orders, class_name: "Cats::Warehouse::DispatchOrder", dependent: :nullify
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :destroy
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :destroy
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :destroy
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :destroy
      has_many :inventory_lots, class_name: "Cats::Warehouse::InventoryLot", dependent: :destroy
      has_many :user_assignments, class_name: "Cats::Warehouse::UserAssignment", dependent: :destroy

      enum :ownership_type, {
        self_owned: "self_owned",
        rental: "rental"
      }, prefix: true

      before_validation :inherit_location_and_management_from_hub
      before_destroy :store_previous_hub_id

      validates :name, presence: true
      validates :ownership_type, presence: true, inclusion: { in: ownership_types.keys }
      validates :kebele, numericality: { only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 40, allow_nil: true }
      validate :ownership_type_rules
      validate :rental_document_required_for_rental
      validate :hub_location_consistency, if: -> { hub.present? && location_id.present? }

      after_commit :recalculate_related_hub_capacities

      MANAGED_UNDER_VALUES = ["Hub", "federal", "regional", "zonal", "woreda", "kebele"].freeze
      private

      def inherit_location_and_management_from_hub
        return if hub.blank?

        self.location_id = hub.location_id
        self.managed_under = "Hub"
      end

      def ownership_type_rules
        if hub_id.present?
          errors.add(:managed_under, "must be 'Hub' when warehouse belongs to a hub") if managed_under != "Hub"
        else
          if managed_under.blank?
            errors.add(:managed_under, "can't be blank")
            return
          end

          unless MANAGED_UNDER_VALUES.include?(managed_under) && managed_under != "Hub"
            errors.add(:managed_under, "must be one of: federal, regional, zonal, woreda, kebele")
          end
        end
      end

      def rental_document_required_for_rental
        return unless ownership_type_rental?
        return if rental_agreement_document.attached? || rental_agreement_document.attachment.present?

        errors.add(:rental_agreement_document, "must be attached for rental warehouses")
      end

      def hub_location_consistency
        return if location_id == hub.location_id

        errors.add(:location_id, "must match the selected hub location")
      end

      def recalculate_related_hub_capacities
        hub_ids = []
        hub_ids << hub_id if hub_id.present?
        hub_ids << @previous_hub_id if @previous_hub_id.present?
        hub_ids.compact.uniq.each { |id| HubCapacityRecalculator.call(id) }
      end

      def store_previous_hub_id
        @previous_hub_id = hub_id
      end
    end
  end
end
