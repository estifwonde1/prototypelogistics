# frozen_string_literal: true

module Cats
  module Warehouse
    # Narrow dispatch-order nested data to one warehouse or hub context (multi-facility managers).
    module DispatchOrderViewerScope
      module_function

      def lines_for_hub(order, hub_id:)
        lines = order.dispatch_order_lines
        return lines if hub_id.blank?

        hid = hub_id.to_i
        return lines.none if hid <= 0

        wh_ids = Warehouse.where(hub_id: hid).pluck(:id)
        
        by_dest = lines.where(hub_id: hid)
        by_dest = by_dest.or(lines.where(warehouse_id: wh_ids)) if wh_ids.any?
        
        by_dest
      end

      def authorizations_for_hub(order, hub_id:)
        rel = DispatchOrderAuthorization.where(dispatch_order_id: order.id, status: DispatchOrderAuthorization::CONFIRMED)
        return rel if hub_id.blank?

        hid = hub_id.to_i
        return rel.none if hid <= 0

        wh_ids = Warehouse.where(hub_id: hid).pluck(:id)
        
        rel.where(warehouse_id: wh_ids)
      end

      def lines_for(order, warehouse_id:)
        lines = order.dispatch_order_lines
        return lines if warehouse_id.blank?

        wh_id = warehouse_id.to_i
        return lines.none if wh_id <= 0

        lines.where(warehouse_id: wh_id)
      end

      def authorizations_for(order, warehouse_id:)
        rel = DispatchOrderAuthorization.where(dispatch_order_id: order.id, status: DispatchOrderAuthorization::CONFIRMED)
        return rel if warehouse_id.blank?

        wh_id = warehouse_id.to_i
        return rel.none if wh_id <= 0

        rel.where(warehouse_id: wh_id)
      end
    end
  end
end
