module Cats
  module Warehouse
    class ApplicationPolicy
      attr_reader :user, :record

      class Scope
        attr_reader :user, :scope

        def initialize(user, scope)
          @user = user
          @scope = scope
        end

        def resolve
          scope.none
        end
      end

      def initialize(user, record)
        @user = user
        @record = record
      end

      def index?
        false
      end

      def show?
        false
      end

      def create?
        false
      end

      def update?
        false
      end

      def destroy?
        false
      end

      private

      def admin?
        user&.has_role?("Admin") || user&.has_role?("Superadmin")
      end

      def hub_manager?
        user&.has_role?("Hub Manager")
      end

      def warehouse_manager?
        user&.has_role?("Warehouse Manager")
      end

      def storekeeper?
        user&.has_role?("Storekeeper")
      end

      def inspector?
        user&.has_role?("Inspector")
      end

      def dispatcher?
        user&.has_role?("Dispatcher")
      end
    end
  end
end
