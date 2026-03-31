module Cats
  module Warehouse
    class PlanningScopeQuery
      def initialize(user:, scope:)
        @access = AccessContext.new(user: user)
        @scope = scope
      end

      def call
        return scoped_relation if access.admin? || access.dispatch_planner?

        location_ids = Warehouse.where(id: access.accessible_warehouse_ids).select(:location_id)

        case model_name
        when "Cats::Warehouse::DispatchPlan"
          scoped_relation
            .joins(:dispatch_plan_items)
            .where(cats_core_dispatch_plan_items: { source_id: location_ids })
            .or(
              scoped_relation
                .joins(:dispatch_plan_items)
                .where(cats_core_dispatch_plan_items: { destination_id: location_ids })
            )
            .distinct
        when "Cats::Warehouse::DispatchPlanItem"
          scoped_relation
            .where(source_id: location_ids)
            .or(scoped_relation.where(destination_id: location_ids))
        when "Cats::Warehouse::HubAuthorization"
          scoped_relation
            .joins(:dispatch_plan_item)
            .where(cats_core_dispatch_plan_items: { source_id: location_ids })
            .or(
              scoped_relation
                .joins(:dispatch_plan_item)
                .where(cats_core_dispatch_plan_items: { destination_id: location_ids })
            )
            .distinct
        else
          scoped_relation.none
        end
      end

      private

      attr_reader :access, :scope

      def scoped_relation
        scope.is_a?(Class) ? scope.all : scope
      end

      def model_name
        scoped_relation.klass.name
      end
    end
  end
end
