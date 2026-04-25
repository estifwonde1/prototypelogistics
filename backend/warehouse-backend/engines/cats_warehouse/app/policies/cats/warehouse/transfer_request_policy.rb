# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)
          
          if access.admin?
            scope.all
          elsif access.warehouse_manager?
            # WM sees all requests in their warehouses
            scope.where(warehouse_id: access.accessible_warehouse_ids)
          elsif access.storekeeper?
            # Storekeepers see their own requests
            scope.where(requested_by_id: user.id)
          else
            scope.none
          end
        end
      end

      def index?
        admin? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        storekeeper?
      end

      def approve?
        admin? || warehouse_manager?
      end

      def reject?
        admin? || warehouse_manager?
      end

      private

      def user_context
        @user_context ||= AccessContext.new(user: user)
      end
    end
  end
end
