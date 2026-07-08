# frozen_string_literal: true

module Cats
  module Warehouse
    class StoreOccupancyUpdater
      def self.call(store: nil, store_id: nil)
        id = store&.id || store_id
        raise ArgumentError, "store or store_id is required" if id.blank?

        new(id).call
      end

      def initialize(store_id)
        @store_id = store_id
      end

      def call
        store = Store.lock.find_by(id: @store_id)
        return unless store

        new_occupied_floor = Stack
          .where(store_id: @store_id)
          .where.not(stack_status: "empty")
          .sum("length * width")
          .to_f

        new_available_floor = [store.usable_space.to_f - new_occupied_floor, 0].max

        updates = {
          occupied_space: new_occupied_floor.round(4),
          available_space: new_available_floor.round(4)
        }

        if store.has_attribute?(:occupied_volume_m3)
          new_occupied_vol = Stack
            .where(store_id: @store_id)
            .where.not(stack_status: "empty")
            .sum(:occupied_volume)
            .to_f

          new_available_vol = [store.usable_volume_m3.to_f - new_occupied_vol, 0].max
          updates[:occupied_volume_m3] = new_occupied_vol.round(4)
          updates[:available_volume_m3] = new_available_vol.round(4)
        end

        store.update_columns(updates)
        store
      end
    end
  end
end
