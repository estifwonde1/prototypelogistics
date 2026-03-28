module Cats
  module Warehouse
    class InventoryLedger
      def self.apply_receipt!(warehouse:, item:, transaction_date:, reference:)
        new(
          warehouse: warehouse,
          item: item,
          transaction_date: transaction_date,
          reference: reference,
          quantity_delta: item.quantity.to_f
        ).call
      end

      def self.apply_issue!(warehouse:, item:, transaction_date:, reference:)
        new(
          warehouse: warehouse,
          item: item,
          transaction_date: transaction_date,
          reference: reference,
          quantity_delta: -item.quantity.to_f
        ).call
      end

      def self.apply_adjustment!(warehouse:, item:, quantity_delta:, transaction_date:, reference:)
        new(
          warehouse: warehouse,
          item: item,
          transaction_date: transaction_date,
          reference: reference,
          quantity_delta: quantity_delta.to_f
        ).call
      end

      def initialize(warehouse:, item:, transaction_date:, reference:, quantity_delta:)
        @warehouse = warehouse
        @item = item
        @transaction_date = transaction_date
        @reference = reference
        @quantity_delta = quantity_delta
      end

      def call
        balance = locked_balance
        balance.quantity = balance.quantity.to_f + quantity_delta
        ensure_non_negative!(balance.quantity, "stock balance")
        balance.save!

        return balance unless item.stack_id.present?

        stack = Stack.lock.find(item.stack_id)
        stack.quantity = stack.quantity.to_f + quantity_delta
        ensure_non_negative!(stack.quantity, "stack quantity")
        stack.save!

        StackTransaction.create!(
          source_id: quantity_delta.negative? ? item.stack_id : nil,
          destination_id: quantity_delta.positive? ? item.stack_id : nil,
          transaction_date: transaction_date,
          quantity: quantity_delta.abs,
          unit_id: item.unit_id,
          status: "Confirmed",
          reference_type: reference.class.name,
          reference_id: reference.id
        )

        balance
      end

      private

      attr_reader :warehouse, :item, :transaction_date, :reference, :quantity_delta

      def locked_balance
        attrs = {
          warehouse_id: warehouse.id,
          store_id: item.store_id,
          stack_id: item.stack_id,
          commodity_id: item.commodity_id,
          unit_id: item.unit_id
        }

        StockBalance.lock.find_by(attrs) || StockBalance.create!(attrs.merge(quantity: 0))
      rescue ActiveRecord::RecordNotUnique
        retry
      end

      def ensure_non_negative!(value, label)
        return unless value.negative?

        item.errors.add(:base, "#{label} cannot be negative")
        raise ActiveRecord::RecordInvalid, item
      end
    end
  end
end
