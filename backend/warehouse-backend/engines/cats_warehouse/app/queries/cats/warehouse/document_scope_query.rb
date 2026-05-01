module Cats
  module Warehouse
    class DocumentScopeQuery
      include ContractConstants

      def initialize(user:, scope:)
        @access = AccessContext.new(user: user)
        @scope = scope
      end

      def call
        # Officers with full access should see all documents
        return scoped_relation if access.admin? || access.officer_full_access?

        case model_name
        when "Cats::Warehouse::StockBalance"
          stock_balances_scope
        when "Cats::Warehouse::StackTransaction"
          stack_transactions_scope
        when "Cats::Warehouse::Grn"
          scoped_relation.where(warehouse_id: access.accessible_warehouse_ids)
        when "Cats::Warehouse::Gin"
          scoped_relation.where(warehouse_id: access.accessible_warehouse_ids)
        when "Cats::Warehouse::Inspection"
          scoped_relation.where(warehouse_id: access.accessible_warehouse_ids)
        when "Cats::Warehouse::ReceiptOrder"
          receipt_orders_scope
        when "Cats::Warehouse::DispatchOrder"
          dispatch_orders_scope
        when "Cats::Warehouse::Waybill"
          waybills_scope
        when "Cats::Core::Receipt"
          receipts_scope
        when "Cats::Core::Dispatch"
          dispatches_scope
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

      def stock_balances_scope
        return scoped_relation if access.admin?

        scoped_relation
          .where(warehouse_id: access.accessible_warehouse_ids)
          .or(scoped_relation.where(store_id: access.accessible_store_ids))
          .or(scoped_relation.where(stack_id: access.accessible_stack_ids))
      end

      def stack_transactions_scope
        return scoped_relation if access.admin?

        scoped_relation
          .where(source_id: access.accessible_stack_ids)
          .or(scoped_relation.where(destination_id: access.accessible_stack_ids))
      end

      def receipts_scope
        return scoped_relation if access.admin?

        scoped_relation
          .joins("INNER JOIN cats_core_receipt_authorizations ra ON ra.id = cats_core_receipts.receipt_authorization_id")
          .where("ra.store_id IN (?)", access.accessible_store_ids)
      end

      def dispatches_scope
        return scoped_relation if access.admin?

        scoped_relation
          .joins("LEFT JOIN cats_core_dispatch_authorizations da ON da.dispatch_id = cats_core_dispatches.id")
          .where("da.store_id IN (?)", access.accessible_store_ids)
          .distinct
      end

      def waybills_scope
        return scoped_relation if access.admin?

        location_ids = Warehouse.where(id: access.accessible_warehouse_ids).select(:location_id)

        scoped_relation.where(source_location_id: location_ids)
                      .or(scoped_relation.where(destination_location_id: location_ids))
      end

      # Hub-only receipt orders have warehouse_id nil but hub_id set; include those for hub (and related) roles.
      # Hub Managers only see orders in their hub workflow queue: status must be +assigned+ (not draft/confirmed/etc.).
      # CRITICAL: Hub managers should see orders with lines destined for their hub, even if the order-level hub_id is different
      def receipt_orders_scope
        # Sub-federal officers use hierarchical scoping based on location and level
        if access.officer? && !access.officer_full_access?
          return HierarchicalOrderScopeQuery.new(user: access.user, scope: scoped_relation).call
        end

        wh_ids = access.accessible_warehouse_ids
        hub_ids = receipt_order_visible_hub_ids
        by_warehouse = scoped_relation.where(warehouse_id: wh_ids)
        
        # For hub managers, also include orders where they have hub-level assignments (multi-hub orders)
        if access.hub_manager?
          by_hub = scoped_relation.where(hub_id: hub_ids)
          # Include orders with assignments to this hub (for multi-hub orders)
          assigned_order_ids = ReceiptOrderAssignment.where(hub_id: hub_ids).pluck(:receipt_order_id).uniq
          rel = by_warehouse.or(by_hub).or(scoped_relation.where(id: assigned_order_ids))
          return rel.where(status: [DOCUMENT_STATUSES[:confirmed], DOCUMENT_STATUSES[:assigned]])
        end
        
        rel = hub_ids.blank? ? by_warehouse : by_warehouse.or(scoped_relation.where(hub_id: hub_ids))

        # Warehouse managers also see hub-based orders where they have a warehouse assignment
        if access.warehouse_manager?
          assigned_order_ids = ReceiptOrderAssignment.where(warehouse_id: wh_ids).pluck(:receipt_order_id).uniq
          return rel.or(scoped_relation.where(id: assigned_order_ids))
        end

        # Storekeepers see orders assigned to their store
        if access.storekeeper?
          store_ids = access.assigned_store_ids
          assigned_order_ids = ReceiptOrderAssignment.where(store_id: store_ids).pluck(:receipt_order_id).uniq
          return scoped_relation.where(id: assigned_order_ids)
        end

        rel
      end

      # Dispatch orders use hierarchical scoping for sub-federal officers.
      # Other roles (hub manager, warehouse manager, storekeeper) use warehouse-based scoping.
      def dispatch_orders_scope
        # Sub-federal officers use hierarchical scoping based on location and level
        if access.officer? && !access.officer_full_access?
          return HierarchicalOrderScopeQuery.new(user: access.user, scope: scoped_relation).call
        end

        scoped_relation.where(warehouse_id: access.accessible_warehouse_ids)
      end

      def receipt_order_visible_hub_ids
        ids = []
        ids.concat(access.assigned_hub_ids) if access.hub_manager?
        if access.warehouse_manager?
          ids.concat(
            Warehouse.where(id: access.assigned_warehouse_ids).where.not(hub_id: nil).distinct.pluck(:hub_id)
          )
        end
        if access.officer?
          raw = access.accessible_hub_ids
          ids.concat(raw.is_a?(Array) ? raw : raw.pluck(:id))
        end
        ids.compact.uniq
      end
    end
  end
end
