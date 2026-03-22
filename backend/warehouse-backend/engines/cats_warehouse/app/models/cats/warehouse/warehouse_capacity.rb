module Cats
  module Warehouse
    class WarehouseCapacity < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_capacity"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      before_destroy :store_hub_id
      after_commit :recalculate_hub_capacity

      private

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
