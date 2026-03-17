module Cats
  module Warehouse
    class UserAssignment < ApplicationRecord
      self.table_name = "cats_warehouse_user_assignments"

      belongs_to :user, class_name: "Cats::Core::User"
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true

      validates :user, presence: true
      validate :assignment_target_present

      private

      def assignment_target_present
        return if hub_id.present? || warehouse_id.present? || store_id.present?

        errors.add(:base, "Assignment must include a hub, warehouse, or store")
      end
    end
  end
end
