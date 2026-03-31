module Cats
  module Warehouse
    class UserAssignment < ApplicationRecord
      self.table_name = "cats_warehouse_user_assignments"

      belongs_to :user, class_name: "Cats::Core::User"
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true

      validates :user, presence: true
      validates :role_name,
                presence: true,
                inclusion: { in: ["Hub Manager", "Warehouse Manager", "Storekeeper", "Hub Dispatch Officer", "Hub Dispatch Approver"] }
      validate :assignment_target_present
      validate :assignment_target_matches_role

      private

      def assignment_target_present
        return if hub_id.present? || warehouse_id.present? || store_id.present?

        errors.add(:base, "Assignment must include a hub, warehouse, or store")
      end

      def assignment_target_matches_role
        case role_name
        when "Hub Manager"
          errors.add(:hub_id, "is required for Hub Manager") if hub_id.blank?
          errors.add(:base, "Warehouse/store not allowed for Hub Manager") if warehouse_id.present? || store_id.present?
        when "Hub Dispatch Officer", "Hub Dispatch Approver"
          errors.add(:hub_id, "is required for #{role_name}") if hub_id.blank?
          errors.add(:base, "Warehouse/store not allowed for #{role_name}") if warehouse_id.present? || store_id.present?
        when "Warehouse Manager"
          errors.add(:warehouse_id, "is required for Warehouse Manager") if warehouse_id.blank?
          errors.add(:base, "Hub/store not allowed for Warehouse Manager") if hub_id.present? || store_id.present?
        when "Storekeeper"
          errors.add(:store_id, "is required for Storekeeper") if store_id.blank?
          errors.add(:base, "Hub/warehouse not allowed for Storekeeper") if hub_id.present? || warehouse_id.present?
        end
      end
    end
  end
end
