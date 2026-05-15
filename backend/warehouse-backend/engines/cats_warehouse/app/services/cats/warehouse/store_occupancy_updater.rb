# frozen_string_literal: true

module Cats
  module Warehouse
    # Recomputes a Store's occupied_space and available_space from the live
    # stack data.  Call this inside the same transaction as any inventory
    # movement so the store's space fields are always consistent.
    #
    # Usage:
    #   StoreOccupancyUpdater.call(store_id: 42)
    #   StoreOccupancyUpdater.call(store: store_instance)
    #
    # The updater uses UPDATE … RETURNING so it works correctly even when
    # called concurrently (the row-level lock on the store prevents races).
    class StoreOccupancyUpdater
      # @param store [Store, nil]
      # @param store_id [Integer, nil]
      def self.call(store: nil, store_id: nil)
        id = store&.id || store_id
        raise ArgumentError, "store or store_id is required" if id.blank?

        new(id).call
      end

      def initialize(store_id)
        @store_id = store_id
      end

      def call
        # Lock the store row to prevent concurrent updates from racing.
        store = Store.lock.find_by(id: @store_id)
        return unless store

        # Sum the floor footprint (length × width) of every non-empty stack.
        # usable_space and available_space are now in m² (area), not m³ (volume).
        # occupied_volume on stacks is kept separately for the InventoryLedger
        # volume-based space check (goods physically fit in the stack).
        new_occupied = Stack
          .where(store_id: @store_id)
          .where.not(stack_status: "empty")
          .sum("length * width")
          .to_f

        new_available = [store.usable_space.to_f - new_occupied, 0].max

        store.update_columns(
          occupied_space:  new_occupied.round(4),
          available_space: new_available.round(4)
        )

        store
      end
    end
  end
end
