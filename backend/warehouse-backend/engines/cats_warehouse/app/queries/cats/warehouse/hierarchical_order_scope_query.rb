module Cats::Warehouse
  class HierarchicalOrderScopeQuery
    LEVEL_ORDER = %w[Federal Region Zone Woreda Kebele].freeze

    def initialize(user:, scope:)
      @user = user
      @scope = scope
    end

    def call
      assignment = UserAssignment.where(user: @user).order(created_at: :desc).first
      role = assignment&.role_name.to_s

      # Federal officers and generic officers see everything
      return @scope.all if ["Federal Officer", "Officer"].include?(role) || role.blank?

      location = assignment&.location
      return @scope.none if location.nil?

      officer_level_index = LEVEL_ORDER.index(location.location_type) || 0
      descendant_ids = location_subtree_ids(location.id)

      # Condition (a): order's location is within the officer's geographic subtree
      # Condition (b): order's hierarchical_level is at or below the officer's level
      allowed_levels = LEVEL_ORDER[officer_level_index..]

      @scope.where(location_id: descendant_ids)
            .where(hierarchical_level: allowed_levels)
    end

    private

    def location_subtree_ids(root_id)
      root = Cats::Core::Location.find(root_id)
      # ancestry gem: descendants have ancestry starting with root's ancestry path
      ancestor_path = [root.ancestry, root.id.to_s].compact.join("/")
      Cats::Core::Location
        .where(id: root_id)
        .or(Cats::Core::Location.where("ancestry = ? OR ancestry LIKE ?", ancestor_path, "#{ancestor_path}/%"))
        .pluck(:id)
    end
  end
end
