module Cats
  module Warehouse
    class ApplicationPolicy
      attr_reader :user, :record

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
        user&.has_role?("Admin")
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
