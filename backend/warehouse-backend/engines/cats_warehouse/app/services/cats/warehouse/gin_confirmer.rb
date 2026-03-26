module Cats
  module Warehouse
    class GinConfirmer
      def initialize(gin:, approved_by: nil)
        @gin = gin
        @approved_by = approved_by
      end

      def call
        @gin.ensure_confirmable!

        Gin.transaction do
          @gin.update!(
            status: "Confirmed",
            approved_by: @approved_by || @gin.approved_by
          )

          @gin.gin_items.find_each do |item|
            InventoryLedger.apply_issue!(
              warehouse: @gin.warehouse,
              item: item,
              transaction_date: @gin.issued_on,
              reference: @gin
            )
          end

          enqueue_notification("gin.confirmed", gin_id: @gin.id)

          @gin
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
