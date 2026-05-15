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
      # Hub managers: scoped by hub / hub assignments; statuses include confirmed through completed (excludes draft/cancelled).
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
          roa_t = ReceiptOrderAssignment.table_name
          # Assignments whose hub_id matches (officer / hub-level rows)
          assigned_order_ids = ReceiptOrderAssignment.where(hub_id: hub_ids).distinct.pluck(:receipt_order_id)

          # Warehouse-only assignment rows often omit hub_id; still belong to this hub if the warehouse is under it.
          wh_ids_in_hubs = Warehouse.where(hub_id: hub_ids).pluck(:id)
          assign_wh_order_ids =
            if wh_ids_in_hubs.any?
              ReceiptOrderAssignment
                .where(warehouse_id: wh_ids_in_hubs)
                .where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")
                .distinct
                .pluck(:receipt_order_id)
            else
              []
            end

          # Lines explicitly destined to this hub (federal / multi-hub ROs with order.hub_id blank)
          line_dest_order_ids =
            ReceiptOrderLine.where(destination_hub_id: hub_ids).distinct.pluck(:receipt_order_id)

          ra_t = ReceiptAuthorization.table_name
          ra_wh_order_ids =
            if wh_ids_in_hubs.any?
              ReceiptAuthorization
                .where(warehouse_id: wh_ids_in_hubs)
                .where.not("LOWER(TRIM(#{ra_t}.status)) = ?", ReceiptAuthorization::CANCELLED)
                .distinct
                .pluck(:receipt_order_id)
            else
              []
            end

          linked_order_ids =
            (assigned_order_ids + assign_wh_order_ids + line_dest_order_ids + ra_wh_order_ids).uniq

          rel = by_warehouse.or(by_hub)
          rel = rel.or(scoped_relation.where(id: linked_order_ids)) if linked_order_ids.any?
          # Hub managers must keep seeing receipt orders through the physical receipt lifecycle:
          # after partial warehouse assignment / RAs / stacking, status moves past +assigned+ (e.g.
          # +reserved+, +in_progress+). Those rows must not disappear from the hub Receipt Orders list.
          hub_receipt_queue_statuses = [
            DOCUMENT_STATUSES[:confirmed],
            DOCUMENT_STATUSES[:assigned],
            DOCUMENT_STATUSES[:reserved],
            DOCUMENT_STATUSES[:in_progress],
            DOCUMENT_STATUSES[:completed]
          ].uniq
          return rel.where(status: hub_receipt_queue_statuses)
        end
        
        rel = hub_ids.blank? ? by_warehouse : by_warehouse.or(scoped_relation.where(hub_id: hub_ids))

        # Warehouse managers also see hub-based orders where they have a warehouse assignment,
        # or trucks were authorized directly to their warehouse via Receipt Authorization (routing override).
        if access.warehouse_manager?
          assigned_order_ids = receipt_order_ids_for_warehouse_manager_assignments(wh_ids)
          ra_order_ids = receipt_order_ids_for_warehouse_manager_receipt_authorizations(wh_ids)
          combined_ids = (assigned_order_ids + ra_order_ids).uniq
          return rel.or(scoped_relation.where(id: combined_ids))
        end

        # Storekeepers: store/warehouse assignments plus standalone hub-less orders and RAs at their warehouse.
        if access.storekeeper?
          return storekeeper_receipt_orders_scope
        end

        rel
      end

      def storekeeper_receipt_orders_scope
        store_ids = Array(access.assigned_store_ids).map(&:to_i).uniq
        wh_ids = (
          Array(access.storekeeper_warehouse_ids) +
          (store_ids.any? ? Store.where(id: store_ids).where.not(warehouse_id: nil).distinct.pluck(:warehouse_id) : [])
        ).map(&:to_i).uniq

        return scoped_relation.none if store_ids.empty? && wh_ids.empty?

        roa_t = ReceiptOrderAssignment.table_name
        not_rejected = ReceiptOrderAssignment.where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")

        linked_ids = []

        if store_ids.any?
          linked_ids.concat(not_rejected.where(store_id: store_ids).distinct.pluck(:receipt_order_id))
        end

        if wh_ids.any?
          linked_ids.concat(
            not_rejected.where(warehouse_id: wh_ids, store_id: nil).distinct.pluck(:receipt_order_id)
          )
          linked_ids.concat(scoped_relation.where(warehouse_id: wh_ids).pluck(:id))
        end

        ra_t = ReceiptAuthorization.table_name
        ra_rel = ReceiptAuthorization.where.not("LOWER(TRIM(#{ra_t}.status)) = ?", ReceiptAuthorization::CANCELLED)
        if wh_ids.any?
          ra_rel = ra_rel.where(warehouse_id: wh_ids)
          ra_rel = ra_rel.where("store_id IN (?) OR store_id IS NULL", store_ids) if store_ids.any?
        elsif store_ids.any?
          ra_rel = ra_rel.where(store_id: store_ids)
        end
        linked_ids.concat(ra_rel.distinct.pluck(:receipt_order_id))

        order_ids = linked_ids.compact.uniq
        return scoped_relation.none if order_ids.empty?

        scoped_relation.where(id: order_ids)
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

      # Orders linked by assignment row: same facility warehouse(s) OR personally assigned (covers
      # multi-warehouse managers who only have one UserAssignment row but are assigned_to on other WH rows).
      def receipt_order_ids_for_warehouse_manager_assignments(wh_ids)
        t  = ReceiptOrderAssignment.table_name
        nr = ReceiptOrderAssignment.where.not("LOWER(TRIM(#{t}.status)) = ?", "rejected")
        uid = access.user&.id
        by_wh = nr.where(warehouse_id: wh_ids)
        by_me = uid.present? ? nr.where(assigned_to_id: uid) : nr.none
        by_wh.or(by_me).distinct.pluck(:receipt_order_id)
      end

      def receipt_order_ids_for_warehouse_manager_receipt_authorizations(wh_ids)
        return [] if wh_ids.blank?

        ra_t = ReceiptAuthorization.table_name
        ReceiptAuthorization
          .where(warehouse_id: wh_ids)
          .where.not("LOWER(TRIM(#{ra_t}.status)) = ?", "cancelled")
          .distinct
          .pluck(:receipt_order_id)
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
