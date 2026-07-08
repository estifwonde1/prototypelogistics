module Cats
  module Warehouse
    class WarehouseCapacity < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_capacity"

      USABLE_PERCENTAGE_MIN = 70
      USABLE_PERCENTAGE_MAX = 80
      USABLE_PERCENTAGE_DEFAULT = 75

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      validates :usable_space_percentage,
                numericality: {
                  only_integer: true,
                  greater_than_or_equal_to: USABLE_PERCENTAGE_MIN,
                  less_than_or_equal_to: USABLE_PERCENTAGE_MAX
                },
                allow_nil: true
      validates :length_m, :width_m, :height_m,
                numericality: { greater_than: 0 },
                if: :establishing_dimensions?

      before_validation :derive_capacity_from_dimensions
      before_destroy :store_hub_id
      after_commit :recalculate_hub_capacity

      def capacity_established?
        capacity_established_at.present?
      end

      private

      def establishing_dimensions?
        length_m.present? || width_m.present? || height_m.present?
      end

      def derive_capacity_from_dimensions
        return unless length_m.present? && width_m.present? && height_m.present?

        pct = usable_space_percentage.presence || USABLE_PERCENTAGE_DEFAULT
        result = CapacityCalculator.call(
          length_m: length_m,
          width_m: width_m,
          height_m: height_m,
          usable_space_percentage: pct
        )

        self.total_area_sqm = result.footprint_sqm
        self.usable_volume_m3 = result.usable_volume_m3
        self.total_storage_capacity_mt = result.capacity_mt
        self.usable_storage_capacity_mt = result.capacity_mt

        if result.capacity_mt.positive?
          self.capacity_established_at ||= Time.current
        else
          self.capacity_established_at = nil
        end
      end

      def recalculate_hub_capacity
        hub_ids = []
        hub_ids << warehouse&.hub_id
        hub_ids << @previous_hub_id
        hub_ids.compact.uniq.each { |id| HubCapacityRecalculator.call(id) }
      end

      def store_hub_id
        @previous_hub_id = warehouse&.hub_id
      end
    end
  end
end
