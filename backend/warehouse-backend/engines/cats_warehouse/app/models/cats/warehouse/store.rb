module Cats
  module Warehouse
    class Store < ApplicationRecord
      self.table_name = "cats_warehouse_stores"

      include RequiresEstablishedCapacity

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      has_many :stacks, class_name: "Cats::Warehouse::Stack", dependent: :destroy
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy
      has_many :receipt_order_assignments, class_name: "Cats::Warehouse::ReceiptOrderAssignment", dependent: :destroy
      has_many :dispatch_order_assignments, class_name: "Cats::Warehouse::DispatchOrderAssignment", dependent: :destroy
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :destroy
      has_many :space_reservations, class_name: "Cats::Warehouse::SpaceReservation", dependent: :destroy
      has_many :user_assignments, class_name: "Cats::Warehouse::UserAssignment", dependent: :destroy

      before_validation :calculate_capacity_metrics

      validates :name, :length, :width, :height, :usable_space, :available_space, presence: true
      validates :length, :width, :height, numericality: { greater_than: 0 }
      validates :usable_space, :available_space, numericality: { greater_than_or_equal_to: 0 }
      validate :gangway_dimensions_are_valid
      validate :warehouse_not_fully_allocated_by_existing_store, on: :create
      validate :fits_inside_warehouse_capacity
      requires_warehouse_capacity_established

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

      def current_occupied_space
        if stacks.loaded?
          stacks.reject { |s| s.stack_status == "empty" }.sum(&:footprint_area).to_f
        else
          stacks.where.not(stack_status: "empty").sum("length * width").to_f
        end
      end

      def recalculate_space!
        StoreOccupancyUpdater.call(store: self)
      end

      private

      def calculate_capacity_metrics
        return if length.blank? || width.blank? || height.blank?

        self.usable_space = usable_floor_area

        self.usable_volume_m3 = CapacityCalculator.store_usable_volume_m3(self) if has_attribute?(:usable_volume_m3)

        live_occupied_floor = if persisted?
                                stacks.where.not(stack_status: "empty")
                                      .sum("length * width")
                                      .to_f
                              else
                                0.0
                              end

        self.available_space = [usable_space.to_f - live_occupied_floor, 0].max

        if has_attribute?(:occupied_volume_m3)
          live_occupied_vol = if persisted?
                                stacks.where.not(stack_status: "empty").sum(:occupied_volume).to_f
                              else
                                0.0
                              end
          self.occupied_volume_m3 = live_occupied_vol
          self.available_volume_m3 = [usable_volume_m3.to_f - live_occupied_vol, 0].max
        end

        if has_attribute?(:allocated_capacity_mt)
          self.allocated_capacity_mt = CapacityCalculator.allocated_capacity_mt(self)
        end
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
        return if errors[:base].any? { |msg| msg.include?("fully allocated") }

        capacity = warehouse&.warehouse_capacity
        return if capacity.blank? || !capacity.capacity_established?

        if capacity.total_area_sqm.present?
          sibling_area = warehouse.stores.where.not(id: id).to_a.sum(&:footprint_area)
          total_area = sibling_area + footprint_area

          if total_area > capacity.total_area_sqm.to_f
            errors.add(:base, "Total store area cannot exceed the warehouse total area")
          end
        end

        return unless has_attribute?(:usable_volume_m3) && capacity.usable_volume_m3.present?

        sibling_effective_vol = warehouse.stores.where.not(id: id).sum do |sibling|
          CapacityCalculator.effective_store_volume_m3(sibling, warehouse_capacity: capacity)
        end
        self_effective_vol = CapacityCalculator.effective_store_volume_m3(self, warehouse_capacity: capacity)
        total_vol = sibling_effective_vol + self_effective_vol
        if total_vol > capacity.usable_volume_m3.to_f + 1e-6
          errors.add(:base, "Total store volume cannot exceed the warehouse usable volume")
        end

        return unless has_attribute?(:allocated_capacity_mt) && capacity.usable_storage_capacity_mt.present?

        sibling_mt = warehouse.stores.where.not(id: id).sum(:allocated_capacity_mt).to_f
        total_mt = sibling_mt + allocated_capacity_mt.to_f
        if total_mt > capacity.usable_storage_capacity_mt.to_f + 1e-6
          errors.add(:base, "Total store capacity cannot exceed the warehouse storage capacity (MT)")
        end
      end

      def warehouse_not_fully_allocated_by_existing_store
        capacity = warehouse&.warehouse_capacity
        return if capacity.blank? || !capacity.capacity_established?

        fully_allocated = warehouse.stores.reload.any? do |existing|
          CapacityCalculator.store_fully_occupies_warehouse?(existing, warehouse_capacity: capacity)
        end
        return unless fully_allocated

        errors.add(
          :base,
          "Warehouse is fully allocated by an existing store. Reduce that store's size before adding another."
        )
      end
    end
  end
end
