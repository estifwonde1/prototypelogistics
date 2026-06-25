# frozen_string_literal: true

module Cats
  module Warehouse
    # Narrow receipt-order nested data to one warehouse context (multi-facility managers).
    module ReceiptOrderViewerScope
      module_function

      def assignments_for_hub(order, hub_id:)
        rel = order.receipt_order_assignments
        return rel if hub_id.blank?

        hid = hub_id.to_i
        return rel.none if hid <= 0

        wh_ids = Warehouse.where(hub_id: hid).pluck(:id)
        roa_t = ReceiptOrderAssignment.table_name
        scoped = rel.where("#{roa_t}.hub_id = ?", hid)
        scoped = scoped.or(rel.where("#{roa_t}.warehouse_id IN (?)", wh_ids)) if wh_ids.any?
        scoped.where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")
      end

      def lines_for_hub(order, hub_id:, assignments: nil)
        lines = order.receipt_order_lines
        return lines if hub_id.blank?

        hid = hub_id.to_i
        return lines.none if hid <= 0

        wh_ids = Warehouse.where(hub_id: hid).pluck(:id)
        scoped_assignments = assignments || assignments_for_hub(order, hub_id: hid)
        assignment_line_ids =
          scoped_assignments
            .where.not(receipt_order_line_id: nil)
            .distinct
            .pluck(:receipt_order_line_id)

        by_dest = lines.where(destination_hub_id: hid)
        by_dest = by_dest.or(lines.where(destination_warehouse_id: wh_ids)) if wh_ids.any?

        if assignment_line_ids.any?
          return by_dest.or(lines.where(id: assignment_line_ids)).distinct
        end

        by_dest
      end

      def assignments_for(order, warehouse_id:)
        rel = order.receipt_order_assignments
        return rel if warehouse_id.blank?

        wh_id = warehouse_id.to_i
        return rel.none if wh_id <= 0

        store_ids = Store.where(warehouse_id: wh_id).pluck(:id)
        roa_t = ReceiptOrderAssignment.table_name
        rel
          .where("#{roa_t}.warehouse_id = ? OR #{roa_t}.store_id IN (?)", wh_id, store_ids.presence || [0])
          .where.not("LOWER(TRIM(#{roa_t}.status)) = ?", "rejected")
      end

      def lines_for(order, warehouse_id:, assignments: nil)
        lines = order.receipt_order_lines
        return lines if warehouse_id.blank?

        wh_id = warehouse_id.to_i
        return lines.none if wh_id <= 0

        scoped_assignments = assignments || assignments_for(order, warehouse_id: wh_id)
        roa_t = ReceiptOrderAssignment.table_name
        assignment_line_ids =
          scoped_assignments
            .where("#{roa_t}.receipt_order_line_id IS NOT NULL")
            .distinct
            .pluck(:receipt_order_line_id)

        by_dest = lines.where(destination_warehouse_id: wh_id)
        if assignment_line_ids.any?
          return by_dest.or(lines.where(id: assignment_line_ids)).distinct
        end

        if scoped_assignments.exists? && lines.count == 1
          return lines
        end

        by_dest
      end
    end
  end
end
