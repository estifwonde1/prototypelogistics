module Cats
  module Warehouse
    class ReceiptOrderPolicy < ApplicationPolicy
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
        admin? || warehouse_manager? || officer?
      end

      def update?
        return false unless record.is_a?(ReceiptOrder)
        return false unless record.status_draft?
        return false if level_excluded?

        create?
      end

      def destroy?
        return false if level_excluded?
        update?
      end

      def assign?
        return true if admin?
        return true if officer?

        hub_manager? || warehouse_manager?
      end

      def assignable_managers?
        assign?
      end

      def reserve_space?
        return true if admin?
        return false unless record.is_a?(ReceiptOrder)

        access = AccessContext.new(user: user)
        wh_ids = accessible_warehouse_id_values
        hub_ids = access.accessible_hub_ids
        hub_ids = hub_ids.is_a?(Array) ? hub_ids : hub_ids.pluck(:id)

        if warehouse_manager?
          return wh_ids.include?(record.warehouse_id.to_i) || hub_ids.include?(record.hub_id.to_i)
        end

        return true if storekeeper?

        false
      end

      def workflow?
        show?
      end

      def confirm?
        return false unless record.is_a?(ReceiptOrder)
        return false unless record.status.to_s.casecmp("draft").zero?
        return false if level_excluded?

        return true if admin?
        return true if officer?  # Officers can confirm any order
        return false unless warehouse_manager?

        accessible_warehouse_id_values.include?(record.warehouse_id.to_i)
      end

      private

      LEVEL_ORDER = %w[Federal Region Zone Woreda Kebele].freeze

      # AccessContext#accessible_warehouse_ids is an ActiveRecord::Relation for some roles, but for
      # Warehouse Manager it is already an Array<Integer> from UserAssignment — do not call .pluck(:id) on that.
      def accessible_warehouse_id_values
        raw = AccessContext.new(user: user).accessible_warehouse_ids
        if raw.is_a?(Array)
          raw.map { |v| v.is_a?(Integer) ? v : v.try(:id) }.compact.map(&:to_i)
        else
          raw.pluck(:id)
        end
      end

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
