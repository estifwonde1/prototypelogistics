# frozen_string_literal: true

module Cats
  module Warehouse
    # Single source of truth for dimension-based capacity (m², m³, MT).
    # Planning MT uses REFERENCE_M3_PER_MT; receipt enforcement uses per-commodity density.
    class CapacityCalculator
      REFERENCE_M3_PER_MT = 1.25

      Result = Struct.new(
        :footprint_sqm,
        :usable_floor_sqm,
        :usable_volume_m3,
        :capacity_mt,
        keyword_init: true
      )

      def self.call(length_m:, width_m:, height_m:, usable_space_percentage:)
        new(
          length_m: length_m,
          width_m: width_m,
          height_m: height_m,
          usable_space_percentage: usable_space_percentage
        ).call
      end

      def self.mt_from_volume(volume_m3, reference_m3_per_mt: REFERENCE_M3_PER_MT)
        return 0.0 if volume_m3.to_f <= 0 || reference_m3_per_mt.to_f <= 0

        (volume_m3.to_f / reference_m3_per_mt.to_f).round(4)
      end

      def self.volume_from_mt(capacity_mt, reference_m3_per_mt: REFERENCE_M3_PER_MT)
        (capacity_mt.to_f * reference_m3_per_mt.to_f).round(4)
      end

      # Store volume uses full floor geometry (L×W − gangway) × height.
      # Warehouse usable_space_percentage applies only on warehouse_capacity, not here.
      def self.store_usable_volume_m3(store)
        return 0.0 if store.length.blank? || store.width.blank? || store.height.blank?

        floor = [store.usable_floor_area, 0].max
        (floor * store.height.to_f).round(4)
      end

      def self.allocated_capacity_mt(store, warehouse_capacity: nil)
        wh_cap = warehouse_capacity || store.warehouse&.warehouse_capacity
        return 0.0 unless wh_cap&.capacity_established?

        wh_vol = wh_cap.usable_volume_m3.to_f
        return 0.0 if wh_vol <= 0

        store_vol = store_usable_volume_m3(store)
        share = store_vol / wh_vol
        (wh_cap.usable_storage_capacity_mt.to_f * share).round(4)
      end

      def initialize(length_m:, width_m:, height_m:, usable_space_percentage:)
        @length_m = length_m
        @width_m = width_m
        @height_m = height_m
        @pct = usable_space_percentage.presence || WarehouseCapacity::USABLE_PERCENTAGE_DEFAULT
      end

      def call
        l = @length_m.to_f
        w = @width_m.to_f
        h = @height_m.to_f
        return empty_result if l <= 0 || w <= 0 || h <= 0

        footprint = (l * w).round(4)
        usable_floor = (footprint * (@pct.to_f / 100.0)).round(4)
        usable_volume = (usable_floor * h).round(4)
        capacity_mt = self.class.mt_from_volume(usable_volume)

        Result.new(
          footprint_sqm: footprint,
          usable_floor_sqm: usable_floor,
          usable_volume_m3: usable_volume,
          capacity_mt: capacity_mt
        )
      end

      private

      def empty_result
        Result.new(
          footprint_sqm: 0.0,
          usable_floor_sqm: 0.0,
          usable_volume_m3: 0.0,
          capacity_mt: 0.0
        )
      end
    end
  end
end
