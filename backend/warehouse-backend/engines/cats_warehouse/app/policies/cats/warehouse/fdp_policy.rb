module Cats
  module Warehouse
    class FdpPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)
          return scope.all if access.admin?
          return scope.all if access.officer_full_access?

          if access.officer?
            location_ids = access.officer_location_scope_ids
            return scope.none if location_ids.blank?

            return scope.where(location_id: location_ids)
          end

          scope.all
        end
      end

      def index?
        authenticated?
      end

      def show?
        authenticated?
      end

      def create?
        admin?
      end

      def update?
        admin?
      end

      def destroy?
        admin?
      end

      private

      def authenticated?
        user.present?
      end
    end
  end
end
