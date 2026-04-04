module Cats
  module Warehouse
    # Resolves receipt_order.hub from optional client hub_id and optional warehouse.
    # Warehouse hub is used when client omits hub_id (uses warehouse.hub, which may be nil).
    class ReceiptOrderHubResolver
      def self.call(explicit_hub:, warehouse:)
        if explicit_hub.present? && warehouse&.hub_id.present? && explicit_hub.id != warehouse.hub_id
          raise ArgumentError, "hub_id does not match the destination warehouse's hub"
        end

        explicit_hub.presence || warehouse&.hub
      end
    end
  end
end
