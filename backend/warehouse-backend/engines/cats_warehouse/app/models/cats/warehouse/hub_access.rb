module Cats
  module Warehouse
    class HubAccess < ApplicationRecord
      self.table_name = "cats_warehouse_hub_access"

      belongs_to :hub, class_name: "Cats::Warehouse::Hub"

      validates :number_of_loading_docks, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
      validates :distance_from_town_km, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
      validate :loading_dock_count_requires_loading_dock

      private

      def loading_dock_count_requires_loading_dock
        return unless number_of_loading_docks.to_i.positive? && has_loading_dock == false

        errors.add(:number_of_loading_docks, "requires has_loading_dock to be true")
      end
    end
  end
end
