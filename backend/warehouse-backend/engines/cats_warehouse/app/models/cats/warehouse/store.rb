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

      def total_space
        footprint_area * height.to_f
      end

      def gangway_area
        return 0 unless has_gangway?

        gangway_length.to_f * gangway_width.to_f
      end

      def usable_floor_area
        [footprint_area - gangway_area, 0].max
      end

      # Returns the floor area (m²) currently occupied by non-empty stacks.
      def current_occupied_space
        if stacks.loaded?
          stacks.reject { |s| s.stack_status == "empty" }.sum(&:footprint_area).to_f
        else
          stacks.where.not(stack_status: "empty").sum("length * width").to_f
        end
      end

      # Recomputes and persists occupied_space + available_space from live stacks.
      # Delegates to StoreOccupancyUpdater so the logic lives in one place.
      def recalculate_space!
        StoreOccupancyUpdater.call(store: self)
      end

      private

      def calculate_capacity_metrics
        return if length.blank? || width.blank? || height.blank?

        # usable_space is floor area (m²): length × width minus gangway area.
        # Height is NOT included — area-based tracking matches how warehouse
        # capacity is reported (m²) and avoids the unit mismatch with MT.
        self.usable_space = usable_floor_area

        # When dimensions change on an existing store, recompute available_space
        # from the live occupied floor area so we don't overwrite real occupancy data.
        # For new records there are no stacks yet, so occupied is 0.
        live_occupied = if persisted?
                          stacks.where.not(stack_status: "empty")
                                .sum("length * width")
                                .to_f
                        else
                          0.0
                        end

        self.available_space = [usable_space.to_f - live_occupied, 0].max
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

        # Area check: total_area_sqm (m²) vs store footprint_area (m²) — same unit, safe to compare.
        if capacity.total_area_sqm.present?
          sibling_area = warehouse.stores.where.not(id: id).to_a.sum(&:footprint_area)
          total_area   = sibling_area + footprint_area

          if total_area > capacity.total_area_sqm.to_f
            errors.add(:base, "Total store area cannot exceed the warehouse total area")
          end
        end

        # NOTE: usable_storage_capacity_mt is in metric tonnes (MT) while store
        # usable_space is in cubic metres (m³).  Comparing them directly is a
        # unit mismatch — MT requires a commodity-specific density to convert to
        # m³.  This check is intentionally skipped for MVP.  A density-based
        # conversion will be introduced in Phase 3 once the commodity density
        # table is available.
        #
        # if capacity.usable_storage_capacity_mt.present?
        #   total_capacity_m3 = sibling_stores.sum(&:usable_space).to_f + usable_space.to_f
        #   # TODO Phase 3: convert total_capacity_m3 → MT using commodity density
        #   #   and compare against capacity.usable_storage_capacity_mt
        # end
      end
    end
  end
end
