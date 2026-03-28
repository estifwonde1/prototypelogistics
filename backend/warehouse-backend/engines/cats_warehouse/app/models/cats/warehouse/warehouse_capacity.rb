module Cats
  module Warehouse
    class WarehouseCapacity < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_capacity"

      RESERVE_FACTOR = 0.85

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      before_validation :derive_usable_storage_capacity
      before_destroy :store_hub_id
      after_commit :recalculate_hub_capacity

      private

      def derive_usable_storage_capacity
        return if total_storage_capacity_mt.blank?

        self.usable_storage_capacity_mt = (total_storage_capacity_mt.to_f * RESERVE_FACTOR).round(2)
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
