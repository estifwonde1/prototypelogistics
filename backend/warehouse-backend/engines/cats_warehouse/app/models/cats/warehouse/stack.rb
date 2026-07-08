module Cats
  module Warehouse
    class Stack < ApplicationRecord
      self.table_name = "cats_warehouse_stacks"

      FOOTPRINT_OVERLAP_EPS = 1.0e-4

      belongs_to :store, class_name: "Cats::Warehouse::Store"
      # commodity and unit are optional — a stack is a physical space.
      # Commodity is assigned when the first batch of goods is placed in it.
      # When all goods leave, commodity is cleared and the stack is available again.
      belongs_to :commodity, class_name: "Cats::Core::Commodity", optional: true
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure", optional: true
      belongs_to :base_unit, class_name: "Cats::Core::UnitOfMeasure", optional: true

      has_many :outgoing_stack_transactions,
               class_name: "Cats::Warehouse::StackTransaction",
               foreign_key: :source_id,
               dependent: :nullify
      has_many :incoming_stack_transactions,
               class_name: "Cats::Warehouse::StackTransaction",
               foreign_key: :destination_id,
               dependent: :nullify
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy
      has_many :stock_reservations, class_name: "Cats::Warehouse::StockReservation", dependent: :destroy

      include RequiresEstablishedCapacity

      validates :length, :width, :height, presence: true
      validates :length, :width, :height, numericality: { greater_than: 0 }
      validates :quantity, numericality: { greater_than_or_equal_to: 0 }
      validates :base_quantity, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
      validate :fits_inside_store
      validate :fits_inside_store_capacity_mt
      requires_warehouse_capacity_established warehouse_association: -> { store&.warehouse }
      validate :position_fits_inside_store, if: :layout_position_changed?
      validate :no_footprint_overlap_with_sibling_stacks
      validate :commodity_lock_respected, if: :commodity_id_changed?


      before_validation :derive_max_capacity_mt
      before_save :sync_occupied_volume

      def footprint_area
        length.to_f * width.to_f
      end

      def volume
        footprint_area * height.to_f
      end

      protected

      # A stack is considered "layout-positioned" only when both floor coordinates
      # are explicitly set.  nil start_x/start_y means the stack is a placeholder
      # (e.g. a space-reservation stub) that has not yet been placed on the floor.
      # All spatial validations (overlap, boundary) are skipped for unpositioned stacks
      # so that multiple reservations can coexist in the same store without colliding.
      # A real position must be assigned before or at putaway (GRN confirmation).
      def layout_positioned_for_overlap?
        store_id.present? &&
          start_x.present? &&
          start_y.present? &&
          length.to_f > FOOTPRINT_OVERLAP_EPS &&
          width.to_f > FOOTPRINT_OVERLAP_EPS
      end

      private

      # Keep occupied_volume consistent with quantity and dimensions.
      # InventoryLedger also sets this explicitly, but having it here ensures
      # correctness when stacks are saved through other paths (e.g. admin edits).
      def sync_occupied_volume
        return unless has_attribute?(:occupied_volume)

        self.occupied_volume = quantity.to_f.positive? ? volume : 0.0
      end

      def derive_max_capacity_mt
        return unless has_attribute?(:max_capacity_mt)

        self.max_capacity_mt = CapacityCalculator.mt_from_volume(volume)
      end

      def fits_inside_store_capacity_mt
        return unless store.present?
        return unless has_attribute?(:max_capacity_mt)
        return unless store.has_attribute?(:allocated_capacity_mt)

        sibling_mt = store.stacks.where.not(id: id).sum(:max_capacity_mt).to_f
        total_mt = sibling_mt + max_capacity_mt.to_f
        store_cap = store.allocated_capacity_mt.to_f
        return if store_cap <= 0

        return if total_mt <= store_cap + 1e-6

        errors.add(:base, "Total stack capacity cannot exceed the store allocated capacity (MT)")
      end

      # A stack that holds goods (quantity > 0) cannot have its commodity changed
      # to a DIFFERENT commodity type. Same commodity (different batch) is allowed.
      # A different commodity type is only allowed once the stack is empty (quantity == 0).
      def commodity_lock_respected
        return unless quantity.to_f > 0
        return unless commodity_id_was.present?
        return if commodity_id == commodity_id_was # no change

        old_commodity = Cats::Core::Commodity.find_by(id: commodity_id_was)
        new_commodity = Cats::Core::Commodity.find_by(id: commodity_id)
        return unless old_commodity && new_commodity

        old_name = old_commodity.read_attribute(:name).to_s.strip.downcase
        new_name = new_commodity.read_attribute(:name).to_s.strip.downcase

        return if old_name == new_name # same commodity type — allowed

        errors.add(:commodity,
                   "cannot be changed while the stack holds goods. " \
                   "Current commodity: #{old_commodity.read_attribute(:name)}. " \
                   "Remove all goods before placing a different commodity.")
      end

      # Axis-aligned rectangles on the store floor (X = length axis, Y = width axis).
      def axis_aligned_footprints_overlap?(ax, ay, al, aw, bx, by, bl, bw)
        eps = FOOTPRINT_OVERLAP_EPS
        ax < bx + bl - eps && bx < ax + al - eps && ay < by + bw - eps && by < ay + aw - eps
      end

      def no_footprint_overlap_with_sibling_stacks
        return unless layout_positioned_for_overlap?

        ax = start_x.to_f
        ay = start_y.to_f
        al = length.to_f
        aw = width.to_f

        siblings = self.class.where(store_id: store_id)
        siblings = siblings.where.not(id: id) if persisted?

        siblings.find_each do |other|
          next unless other.layout_positioned_for_overlap?

          ox = other.start_x.to_f
          oy = other.start_y.to_f
          ol = other.length.to_f
          ow = other.width.to_f

          next unless axis_aligned_footprints_overlap?(ax, ay, al, aw, ox, oy, ol, ow)

          label = other.code.presence || "stack ##{other.id}"
          errors.add(:base, "Stack footprint overlaps another stack (#{label}) in this store")
          break
        end
      end

      def fits_inside_store
        return unless store.present?

        if length.to_f > store.length.to_f || width.to_f > store.width.to_f || height.to_f > store.height.to_f
          errors.add(:base, "Stack dimensions cannot exceed the store dimensions")
        end

        if footprint_area > store.usable_floor_area
          errors.add(:base, "Stack footprint cannot exceed the store usable floor area")
        end

        # usable_space is now floor area (m²) — compare footprint, not volume.
        return unless footprint_area > store.usable_space.to_f

        errors.add(:base, "Stack footprint cannot exceed the store usable area")
      end

      def layout_position_changed?
        layout_positioned_for_overlap? &&
          (new_record? ||
            will_save_change_to_store_id? ||
            will_save_change_to_start_x? ||
            will_save_change_to_start_y? ||
            will_save_change_to_length? ||
            will_save_change_to_width?)
      end

      def position_fits_inside_store
        # Only validate boundary when the stack has an explicit floor position.
        # Unpositioned stacks (start_x/start_y nil) are reservation placeholders
        # and are exempt until a real position is assigned at putaway.
        return unless layout_positioned_for_overlap?
        return unless store.present?

        if start_x.to_f < -FOOTPRINT_OVERLAP_EPS || start_y.to_f < -FOOTPRINT_OVERLAP_EPS
          errors.add(:base, "Stack position cannot be negative")
        end

        if start_x.to_f + length.to_f > store.length.to_f + FOOTPRINT_OVERLAP_EPS ||
           start_y.to_f + width.to_f > store.width.to_f + FOOTPRINT_OVERLAP_EPS
          errors.add(:base, "Stack position and size must stay within the store floor")
        end
      end
    end
  end
end
