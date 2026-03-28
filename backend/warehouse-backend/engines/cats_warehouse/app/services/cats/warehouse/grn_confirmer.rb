module Cats
  module Warehouse
    class GrnConfirmer
      def initialize(grn:, approved_by: nil)
        @grn = grn
        @approved_by = approved_by
      end

      def call
        @grn.ensure_confirmable!

        Grn.transaction do
          @grn.update!(
            status: "Confirmed",
            approved_by: @approved_by || @grn.approved_by
          )

          @grn.grn_items.find_each do |item|
            InventoryLedger.apply_receipt!(
              warehouse: @grn.warehouse,
              item: item,
              transaction_date: @grn.received_on,
              reference: @grn
            )
          end

          enqueue_notification("grn.confirmed", grn_id: @grn.id)

          @grn
        end
      end

      private
      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
