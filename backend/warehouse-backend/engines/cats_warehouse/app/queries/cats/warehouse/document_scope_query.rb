module Cats
  module Warehouse
    class DocumentScopeQuery
      def initialize(user:, scope:)
        @access = AccessContext.new(user: user)
        @scope = scope
      end

      def call
        # Officers should see all documents (they're coordinators)
        return scoped_relation if access.admin? || access.officer?

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
          scoped_relation.where(warehouse_id: access.accessible_warehouse_ids)
        when "Cats::Warehouse::DispatchOrder"
          scoped_relation.where(warehouse_id: access.accessible_warehouse_ids)
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
    end
  end
end
