module Cats
  module Warehouse
    class GrnConfirmer
      def initialize(grn:, approved_by: nil)
        @grn = grn
        @approved_by = approved_by
      end

      def call
        raise ArgumentError, "GRN is already confirmed" if @grn.status == "Confirmed"

        Grn.transaction do
          @grn.update!(
            status: "Confirmed",
            approved_by: @approved_by || @grn.approved_by
          )

          @grn.grn_items.find_each do |item|
            apply_stock_balance(item)
            apply_stack_quantity(item)
            apply_stack_transaction(item)
          end

          @grn
        end
      end

      private

      def apply_stock_balance(item)
        balance = StockBalance.find_or_initialize_by(
          warehouse_id: @grn.warehouse_id,
          store_id: item.store_id,
          stack_id: item.stack_id,
          commodity_id: item.commodity_id,
          unit_id: item.unit_id
        )
        balance.quantity = balance.quantity.to_f + item.quantity.to_f
        balance.save!
      end

      def apply_stack_quantity(item)
        return unless item.stack_id

        stack = Stack.lock.find(item.stack_id)
        stack.quantity = stack.quantity.to_f + item.quantity.to_f
        stack.save!
      end

      def apply_stack_transaction(item)
        return unless item.stack_id

        StackTransaction.create!(
          source_id: item.stack_id,
          destination_id: item.stack_id,
          transaction_date: @grn.received_on,
          quantity: item.quantity,
          unit_id: item.unit_id,
          status: "Confirmed"
        )
      end
    end
  end
end
