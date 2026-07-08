module Cats
  module Warehouse
    # Pundit policy for the dashboard endpoints.
    # authorize :dashboard, :officer? is called with a symbol record, so Pundit
    # looks for DashboardPolicy. The record will be :dashboard.
    class DashboardPolicy < ApplicationPolicy
      def officer?
        admin? || hub_manager? || warehouse_manager? || any_officer?
      end

      def warehouse_manager?
        admin? || user&.has_role?("Warehouse Manager") || user&.has_role?("Quality Assurance")
      end

      private

      def any_officer?
        OFFICER_ROLE_NAMES.any? { |role| user&.has_role?(role) }
      end
    end
  end
end
