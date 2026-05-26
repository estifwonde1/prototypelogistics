# frozen_string_literal: true

module Cats
  module Warehouse
    class PackagingTransactionPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)
          return scope.all if access.admin?

          scope.where(warehouse_id: access.accessible_warehouse_ids)
        end
      end

      def index?
        admin? || warehouse_manager? || hub_manager? || storekeeper?
      end

      def create?
        index?
      end
    end
  end
end
