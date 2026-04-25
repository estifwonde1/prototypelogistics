module Cats
  module Warehouse
    class UserAssignment < ApplicationRecord
      self.table_name = "cats_warehouse_user_assignments"

      belongs_to :user, class_name: "Cats::Core::User"
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse", optional: true
      belongs_to :store, class_name: "Cats::Warehouse::Store", optional: true
      belongs_to :location, class_name: "Cats::Core::Location", optional: true

      validates :user, presence: true
      validates :role_name, presence: true, inclusion: { in: [
        "Hub Manager",
        "Warehouse Manager",
        "Storekeeper",
        "Officer",
        "Federal Officer",
        "Regional Officer",
        "Zonal Officer",
        "Woreda Officer",
        "Kebele Officer"
      ] }
      validate :assignment_target_present
      validate :assignment_target_matches_role

      private

      def assignment_target_present
        return if federal_officer?
        return if hub_id.present? || warehouse_id.present? || store_id.present? || location_id.present?

        errors.add(:base, "Assignment must include a hub, warehouse, or store")
      end

      def assignment_target_matches_role
        case role_name
        when "Hub Manager"
          errors.add(:hub_id, "is required for Hub Manager") if hub_id.blank?
          errors.add(:base, "Warehouse/store not allowed for Hub Manager") if warehouse_id.present? || store_id.present?
        when "Warehouse Manager"
          errors.add(:warehouse_id, "is required for Warehouse Manager") if warehouse_id.blank?
          errors.add(:base, "Hub/store not allowed for Warehouse Manager") if hub_id.present? || store_id.present?
        when "Storekeeper"
          errors.add(:base, "Storekeeper must be assigned to a warehouse or store") if warehouse_id.blank? && store_id.blank?
          errors.add(:base, "Hub not allowed for Storekeeper") if hub_id.present?
          errors.add(:base, "Storekeeper cannot have both warehouse and store assignment") if warehouse_id.present? && store_id.present?
        when "Officer"
          errors.add(:warehouse_id, "is required for Officer") if warehouse_id.blank?
          errors.add(:base, "Hub/store not allowed for Officer") if hub_id.present? || store_id.present?
        when "Federal Officer"
          errors.add(:base, "No location is allowed for Federal Officer") if hub_id.present? || warehouse_id.present? || store_id.present? || location_id.present?
        when "Regional Officer"
          validate_location_assignment(expected_type: Cats::Core::Location::REGION, label: "region")
        when "Zonal Officer"
          validate_location_assignment(expected_type: Cats::Core::Location::ZONE, label: "zone")
        when "Woreda Officer"
          validate_location_assignment(expected_type: Cats::Core::Location::WOREDA, label: "woreda")
        when "Kebele Officer"
          validate_location_assignment(expected_type: kebele_location_type, label: "kebele")
        end
      end

      def validate_location_assignment(expected_type:, label:)
        errors.add(:location_id, "is required for #{label} assignment") if location_id.blank?
        errors.add(:base, "Hub/warehouse/store not allowed for #{label} assignment") if hub_id.present? || warehouse_id.present? || store_id.present?
        return if location_id.blank?
        return if location&.location_type.to_s == expected_type.to_s

        errors.add(:location_id, "must be a #{label}")
      end

      def kebele_location_type
        return Cats::Core::Location::KEBELE if Cats::Core::Location.const_defined?(:KEBELE)

        "Kebele"
      end

      def federal_officer?
        role_name == "Federal Officer"
      end
    end
  end
end
