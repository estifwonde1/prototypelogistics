module Cats
  module Warehouse
    module InAppNotificationCopy
      module_function

      def for(event_type, params)
        p = params.stringify_keys
        ref = p["receipt_order_reference"].presence || (p["receipt_order_id"].present? ? "RO ##{p['receipt_order_id']}" : nil)

        case event_type
        when "receipt_order.confirmed"
          { title: "Receipt order confirmed", body: ref ? "Receipt order #{ref} was confirmed." : "A receipt order was confirmed." }
        when "receipt_order.assigned"
          { title: "New assignment", body: ref ? "You were assigned work on #{ref}." : "You have a new receipt order assignment." }
        when "receipt_order.completed"
          { title: "Receipt order completed", body: ref ? "#{ref} is fully completed." : "A receipt order was completed." }
        when "receipt_authorization.created"
          { title: "Receipt authorization created", body: "A new receipt authorization was created for your facility." }
        when "receipt_authorization.cancelled"
          { title: "Receipt authorization cancelled", body: "A receipt authorization was cancelled." }
        when "receipt_authorization.assigned_to_storekeeper"
          { title: "Receipt authorization assigned", body: "A receipt authorization was assigned to you." }
        when "receipt_authorization.broadcast_to_storekeepers"
          { title: "Driver arrival", body: "A truck is arriving at your store. Open Driver Arrivals to record receipt." }
        when "receipt_authorization.driver_confirmed"
          { title: "Driver confirmed delivery", body: "Driver confirmation was recorded; draft GRN is ready." }
        when "receipt_authorization.grn_confirmed"
          { title: "GRN confirmed", body: "A goods receipt was confirmed for a receipt authorization." }
        when "inspection.confirmed"
          { title: "Inspection confirmed", body: "An inspection was confirmed." }
        when "dispatch_order.confirmed", "dispatch_order.self_approved"
          { title: "Dispatch order confirmed", body: "A dispatch order was confirmed and is ready for warehouse authorization." }
        when "dispatch_order_authorization.created"
          { title: "Dispatch authorization created", body: "A new dispatch authorization awaits action at your warehouse." }
        when "dispatch_order_authorization.confirmed"
          { title: "Dispatch authorization confirmed", body: "Dispatch authorization was confirmed; waybill generated." }
        when "waybill.created"
          { title: "Waybill created", body: "A waybill was generated for outbound dispatch." }
        when "gin.draft_generated"
          { title: "GIN draft ready", body: "A draft GIN is ready for stack allocation and confirmation." }
        when "packaging_transaction.posted"
          { title: "Packaging transaction posted", body: "A packaging movement was recorded." }
        when "grn.confirmed"
          { title: "GRN confirmed", body: "A goods receipt note was confirmed." }
        when "gin.confirmed"
          { title: "GIN confirmed", body: "A goods issue note was confirmed." }
        when "waybill.confirmed"
          { title: "Waybill confirmed", body: "A waybill was confirmed." }
        else
          { title: event_type.to_s.tr("_", " ").capitalize, body: "You have a new notification." }
        end
      end
    end
  end
end
