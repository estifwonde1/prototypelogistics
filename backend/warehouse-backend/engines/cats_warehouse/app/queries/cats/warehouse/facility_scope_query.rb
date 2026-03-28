module Cats
  module Warehouse
    class FacilityScopeQuery
      def initialize(user:, scope:)
        @access = AccessContext.new(user: user)
        @scope = scope
      end

      def call
        case model_name
        when "Cats::Warehouse::Hub"
          hubs_scope
        when "Cats::Warehouse::Warehouse"
          warehouses_scope
        when "Cats::Warehouse::Store"
          stores_scope
        when "Cats::Warehouse::Stack"
          stacks_scope
        else
          scoped_relation.none
        end
      end

      private

      attr_reader :access, :scope

      def model_name
        scoped_relation.klass.name
      end

      def scoped_relation
        scope.is_a?(Class) ? scope.all : scope
      end

      def hubs_scope
        return scoped_relation if access.admin?
        return scoped_relation.where(id: access.assigned_hub_ids) if access.hub_manager?

        scoped_relation.none
      end

      def warehouses_scope
        return scoped_relation if access.admin?
        return scoped_relation.where(hub_id: access.assigned_hub_ids) if access.hub_manager?
        return scoped_relation.where(id: access.accessible_warehouse_ids) if access.warehouse_manager?
        return scoped_relation.where(id: access.accessible_warehouse_ids) if access.storekeeper?

        scoped_relation.none
      end

      def stores_scope
        return scoped_relation if access.admin?
        return scoped_relation.where(warehouse_id: access.accessible_warehouse_ids) if access.hub_manager? || access.warehouse_manager?
        return scoped_relation.where(id: access.assigned_store_ids) if access.storekeeper?

        scoped_relation.none
      end

      def stacks_scope
        return scoped_relation if access.admin?

        scoped_relation.where(store_id: access.accessible_store_ids)
      end
    end
  end
end
