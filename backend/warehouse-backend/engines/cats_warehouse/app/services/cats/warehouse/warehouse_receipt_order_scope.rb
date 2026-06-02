module Cats
  module Warehouse
    # Warehouse-scoped receipt orders: direct warehouse_id, assignments, or active RAs.
    class WarehouseReceiptOrderScope
      def self.relation_for_warehouse(warehouse_id:)
        warehouse_id = warehouse_id.to_i
        store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)

        roa_t = ReceiptOrderAssignment.table_name
        assignment_order_ids =
          ReceiptOrderAssignment
            .where(warehouse_id: warehouse_id)
            .or(ReceiptOrderAssignment.where(store_id: store_ids))
            .where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")
            .distinct
            .pluck(:receipt_order_id)

        ra_t = ReceiptAuthorization.table_name
        ra_order_ids =
          ReceiptAuthorization
            .where(warehouse_id: warehouse_id)
            .where.not("LOWER(TRIM(#{ra_t}.status)) = ?", ReceiptAuthorization::CANCELLED)
            .distinct
            .pluck(:receipt_order_id)

        assigned_order_ids = (assignment_order_ids + ra_order_ids).uniq

        ReceiptOrder
          .where(warehouse_id: warehouse_id)
          .or(ReceiptOrder.where(id: assigned_order_ids))
      end
    end
  end
end
