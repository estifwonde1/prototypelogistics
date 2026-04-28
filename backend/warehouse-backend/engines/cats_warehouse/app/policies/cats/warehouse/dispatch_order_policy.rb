module Cats
  module Warehouse
    class DispatchOrderPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          DocumentScopeQuery.new(user: user, scope: scope).call
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper? || officer?
      end

      def show?
        return false if level_excluded?
        index?
      end

      def create?
        admin? || hub_manager? || warehouse_manager? || officer?
      end

      def update?
        return false unless record.is_a?(DispatchOrder)
        return false unless record.status_draft?
        return false if level_excluded?

        create?
      end

      def assign?
        return true if admin?

        hub_manager? || warehouse_manager?
      end

      def reserve_stock?
        return true if admin?

        warehouse_manager? || storekeeper?
      end

      def workflow?
        show?
      end

      def confirm?
        return false unless record.is_a?(DispatchOrder)
        return false unless record.status.to_s.casecmp("draft").zero?
        return false if level_excluded?

        return true if admin?
        return true if officer?  # Officers can confirm any order

        # For hub managers, check assigned hub IDs
        if hub_manager?
          assigned_hubs = AccessContext.new(user: user).assigned_hub_ids
          return assigned_hubs.include?(record.hub_id.to_i)
        end

        # For warehouse managers, check assigned warehouse IDs
        return false unless warehouse_manager?

        raw = AccessContext.new(user: user).accessible_warehouse_ids
        warehouse_ids =
          if raw.is_a?(Array)
            raw.map { |v| v.is_a?(Integer) ? v : v.try(:id) }.compact.map(&:to_i)
          else
            raw.pluck(:id)
          end
        warehouse_ids.include?(record.warehouse_id.to_i)
      end

      private

      LEVEL_ORDER = %w[Federal Region Zone Woreda Kebele].freeze

      def officer?
        super
      end

      # Level exclusion check: if the record's hierarchical_level is strictly higher
      # (lower index in LEVEL_ORDER) than the current officer's own level, return false.
      # Federal officers always pass this check.
      def level_excluded?
        return false if admin?
        return false unless officer?

        record_level = record.hierarchical_level.to_s
        return false if record_level == "Federal" || record_level.blank?

        assignment = UserAssignment.where(user: user).order(created_at: :desc).first
        return false if assignment.nil?

        role = assignment.role_name.to_s
        return false if ["Federal Officer", "Officer"].include?(role) || role.blank?

        officer_location = assignment.location
        return true if officer_location.nil?

        officer_level_index = LEVEL_ORDER.index(officer_location.location_type) || 0
        record_level_index = LEVEL_ORDER.index(record_level)

        return false if record_level_index.nil?

        record_level_index < officer_level_index
      end
    end
  end
end
