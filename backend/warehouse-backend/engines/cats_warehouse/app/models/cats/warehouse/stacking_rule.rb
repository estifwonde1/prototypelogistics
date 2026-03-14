module Cats
  module Warehouse
    class StackingRule < ApplicationRecord
      self.table_name = "cats_warehouse_stacking_rules"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      validates :distance_from_wall, :space_between_stack, :distance_from_ceiling,
                :maximum_height, :maximum_length, :maximum_width, :distance_from_gangway,
                presence: true
    end
  end
end
