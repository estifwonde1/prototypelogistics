module Cats
  module Warehouse
    class Store < ApplicationRecord
      self.table_name = "cats_warehouse_stores"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      has_many :stacks, class_name: "Cats::Warehouse::Stack", dependent: :destroy
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :destroy
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :destroy
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :destroy
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :destroy

      before_validation :calculate_capacity_metrics

      validates :name, :length, :width, :height, :usable_space, :available_space, presence: true
      validates :length, :width, :height, numericality: { greater_than: 0 }
      validates :usable_space, :available_space, numericality: { greater_than_or_equal_to: 0 }
      validate :gangway_dimensions_are_valid
      validate :fits_inside_warehouse_capacity

      def footprint_area
        length.to_f * width.to_f
      end

      def gangway_area
        return 0 unless has_gangway?

        gangway_length.to_f * gangway_width.to_f
      end

      def usable_floor_area
        [footprint_area - gangway_area, 0].max
      end

      private

      def calculate_capacity_metrics
        return if length.blank? || width.blank? || height.blank?

        self.usable_space = usable_floor_area * height.to_f
        self.available_space = usable_space
      end

      def gangway_dimensions_are_valid
        return unless has_gangway?

        if gangway_length.to_f <= 0 || gangway_width.to_f <= 0
          errors.add(:base, "Gangway dimensions must be positive when a gangway is enabled")
        end

        return unless gangway_area > footprint_area

        errors.add(:base, "Gangway area cannot exceed the store area")
      end

      def fits_inside_warehouse_capacity
        capacity = warehouse&.warehouse_capacity
        return if capacity.blank?

        sibling_stores = warehouse.stores.where.not(id: id)
        total_area = sibling_stores.sum { |store| store.footprint_area } + footprint_area
        total_capacity = sibling_stores.sum(&:usable_space).to_f + usable_space.to_f

        if capacity.total_area_sqm.present? && total_area > capacity.total_area_sqm.to_f
          errors.add(:base, "Total store area cannot exceed the warehouse total area")
        end

        if capacity.usable_storage_capacity_mt.present? && total_capacity > capacity.usable_storage_capacity_mt.to_f
          errors.add(:base, "Total store capacity cannot exceed the warehouse usable capacity")
        end
      end
    end
  end
end
