module Cats
  module Warehouse
    class GinConfirmer
      def initialize(gin:, approved_by: nil)
        @gin = gin
        @approved_by = approved_by
      end

      def call
        raise ArgumentError, "GIN is already confirmed" if @gin.status == "Confirmed"

        Gin.transaction do
          @gin.update!(
            status: "Confirmed",
            approved_by: @approved_by || @gin.approved_by
          )

          @gin.gin_items.find_each do |item|
            apply_stock_balance(item)
            apply_stack_quantity(item)
            apply_stack_transaction(item)
          end

          enqueue_notification("gin.confirmed", gin_id: @gin.id)

          @gin
        end
      end

      private

      def apply_stock_balance(item)
        balance = StockBalance.find_or_initialize_by(
          warehouse_id: @gin.warehouse_id,
          store_id: item.store_id,
          stack_id: item.stack_id,
          commodity_id: item.commodity_id,
          unit_id: item.unit_id
        )
        balance.quantity = balance.quantity.to_f - item.quantity.to_f
        balance.save!
      end

      def apply_stack_quantity(item)
        return unless item.stack_id

        stack = Stack.lock.find(item.stack_id)
        stack.quantity = stack.quantity.to_f - item.quantity.to_f
        stack.save!
      end

      def apply_stack_transaction(item)
        return unless item.stack_id

        StackTransaction.create!(
          source_id: item.stack_id,
          destination_id: item.stack_id,
          transaction_date: @gin.issued_on,
          quantity: item.quantity,
          unit_id: item.unit_id,
          status: "Confirmed"
        )
      end

      def enqueue_notification(event, payload)
        return unless ENV["ENABLE_WAREHOUSE_JOBS"] == "true"

        NotificationJob.perform_later(event, payload)
      end
    end
  end
end
