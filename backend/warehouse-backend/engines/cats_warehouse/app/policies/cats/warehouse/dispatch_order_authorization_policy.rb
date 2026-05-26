# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          access = AccessContext.new(user: user)
          return scope.all if access.admin?

          parts = []
          parts << warehouse_manager_scope(access) if access.warehouse_manager? || access.hub_manager?
          parts << storekeeper_scope(access) if access.storekeeper?

          return scope.none if parts.empty?
          return parts.first if parts.length == 1

          parts.reduce { |combined, part| combined.or(part) }
        end

        private

        def warehouse_manager_scope(access)
          wh_ids = warehouse_ids_for_manager(access)
          scope.where(warehouse_id: wh_ids)
        end

        def storekeeper_scope(access)
          store_ids = Array(access.accessible_store_ids)
          auth_ids = DispatchOrderAuthorizationStore.where(store_id: store_ids).select(:dispatch_order_authorization_id)
          scope.where(id: auth_ids)
        end

        def warehouse_ids_for_manager(access)
          raw = access.accessible_warehouse_ids
          raw.is_a?(ActiveRecord::Relation) ? raw.pluck(:id) : Array(raw).map(&:to_i)
        end
      end

      def index?
        admin? || hub_manager? || warehouse_manager? || storekeeper?
      end

      def show?
        index?
      end

      def create?
        admin? || warehouse_manager? || hub_manager?
      end

      def confirm?
        create? && record_warehouse_accessible?
      end

      def driver_confirm?
        confirm?
      end

      def create_execution?
        storekeeper? && record_warehouse_accessible?
      end

      private

      def record_warehouse_accessible?
        return true if admin?

        wh_ids = AccessContext.new(user: user).accessible_warehouse_ids
        list = wh_ids.is_a?(ActiveRecord::Relation) ? wh_ids.pluck(:id) : Array(wh_ids).map(&:to_i)
        list.include?(record.warehouse_id.to_i)
      end
    end
  end
end
