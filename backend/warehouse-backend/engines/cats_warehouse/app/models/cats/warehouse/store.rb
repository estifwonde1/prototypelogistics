module Cats
  module Warehouse
    class Store < ApplicationRecord
      self.table_name = "cats_warehouse_stores"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      has_many :stacks, class_name: "Cats::Warehouse::Stack", dependent: :destroy
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy

      before_validation :calculate_capacity_metrics

      validates :name, :length, :width, :height, :usable_space, :available_space, presence: true
      validates :height, numericality: { greater_than: 0 }
      validates :length, :width, numericality: { greater_than_or_equal_to: 2 }
      validates :usable_space, :available_space, numericality: { greater_than_or_equal_to: 0 }
      validate :gangway_dimensions_are_valid
      validate :fits_inside_warehouse_capacity
      validate :fits_inside_warehouse_dimensions

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

        self.available_space = footprint_area.round(2)
        self.usable_space = [(length.to_f - 2) * (width.to_f - 2), 0].max.round(2)
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

        if capacity.total_area_sqm.present? && total_area > capacity.total_area_sqm.to_f
          errors.add(:base, "Total store area cannot exceed the warehouse total area")
        end
      end

      def fits_inside_warehouse_dimensions
        capacity = warehouse&.warehouse_capacity
        return if capacity.blank?

        if capacity.length_m.present? && length.to_f > capacity.length_m.to_f
          errors.add(:length, "must not exceed the warehouse maximum length")
        end

        if capacity.width_m.present? && width.to_f > capacity.width_m.to_f
          errors.add(:width, "must not exceed the warehouse maximum width")
        end

        if capacity.height_m.present? && height.to_f > capacity.height_m.to_f
          errors.add(:height, "must not exceed the warehouse maximum height")
        end
      end
    end
  end
end
