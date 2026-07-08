module Cats::Warehouse
  class LocationTagger
    FEDERAL_ROLES = ["Federal Officer", "Officer"].freeze
    SUB_FEDERAL_ROLES = ["Regional Officer", "Zonal Officer", "Woreda Officer", "Kebele Officer"].freeze

    # Returns { location_id:, hierarchical_level: } to merge into order attributes.
    # Raises ArgumentError if a sub-federal officer has no valid location assignment.
    def self.call(user:)
      assignment = UserAssignment.where(user: user).order(created_at: :desc).first
      role = assignment&.role_name.to_s

      if FEDERAL_ROLES.include?(role) || role.blank?
        return { location_id: nil, hierarchical_level: "Federal" }
      end

      if SUB_FEDERAL_ROLES.include?(role)
        location = assignment&.location
        raise ArgumentError, "A geographic assignment is required to create orders" if location.nil?
        return { location_id: location.id, hierarchical_level: location.location_type }
      end

      { location_id: nil, hierarchical_level: "Federal" }
    end
  end
end
