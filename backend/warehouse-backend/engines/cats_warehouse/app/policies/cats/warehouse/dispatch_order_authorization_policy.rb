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
          return scope.none if store_ids.empty?

          assigned_auth_ids = DispatchOrderAuthorizationStore
            .where(store_id: store_ids)
            .distinct
            .pluck(:dispatch_order_authorization_id)
          warehouse_ids = Store.where(id: store_ids).distinct.pluck(:warehouse_id)
          open_auth_ids = if warehouse_ids.empty?
                            []
                          else
                            DispatchOrderAuthorization
                              .left_outer_joins(:dispatch_order_authorization_stores)
                              .where(warehouse_id: warehouse_ids)
                              .where(cats_warehouse_dispatch_order_authorization_stores: { id: nil })
                              .distinct
                              .pluck(:id)
                          end

          scope.where(id: (assigned_auth_ids + open_auth_ids).uniq)
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
        return confirm? unless storekeeper?

        create_execution?
      end

      def create_execution?
        return storekeeper? if record.blank?

        storekeeper? && record_warehouse_accessible?
      end

      def store_splits?
        create_execution?
      end

      # Lookup endpoints: Pundit infers policy method from controller action name.
      def stores?
        index?
      end

      def stacks?
        index?
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
