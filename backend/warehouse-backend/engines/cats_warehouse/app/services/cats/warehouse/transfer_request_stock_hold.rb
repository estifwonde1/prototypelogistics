# frozen_string_literal: true

module Cats
  module Warehouse
    # Reserves source-stack availability on request create; consumes on transfer; releases on reject.
    class TransferRequestStockHold
      def self.reserve!(transfer_request)
        new(transfer_request).reserve!
      end

      def self.consume_for_transfer!(transfer_request, quantity)
        new(transfer_request).consume_for_transfer!(quantity)
      end

      def self.release!(transfer_request, quantity)
        new(transfer_request).release!(quantity)
      end

      def initialize(transfer_request)
        @transfer_request = transfer_request
        @source_stack = transfer_request.source_stack.reload
      end

      def reserve!
        unless transfer_request.class.column_names.include?("reserved_quantity")
          raise ArgumentError,
                "Database is missing transfer request reservation columns. " \
                "Run: rails db:migrate (then restart the Rails server)."
        end

        qty = transfer_request.quantity.to_f
        raise ArgumentError, "Cannot reserve zero quantity" if qty <= 0

        apply_balance_delta!(reserved_delta: qty)
        transfer_request.update!(reserved_quantity: transfer_request.reserved_quantity.to_f + qty)
        transfer_request
      end

      def consume_for_transfer!(quantity)
        qty = quantity.to_f
        raise ArgumentError, "Consume quantity must be greater than zero" if qty <= 0

        held = transfer_request.reserved_quantity.to_f
        if qty > held + TransferRequest::QTY_EPSILON
          raise ArgumentError,
                "Cannot consume #{qty} from reservation (held: #{held})"
        end

        apply_balance_delta!(reserved_delta: -qty)
        transfer_request.update!(reserved_quantity: held - qty)
      end

      def release!(quantity)
        qty = quantity.to_f
        raise ArgumentError, "Release quantity must be greater than zero" if qty <= 0

        held = transfer_request.reserved_quantity.to_f
        # Requests created before reservation was introduced have nothing held.
        return transfer_request if held <= TransferRequest::QTY_EPSILON

        if qty > held + TransferRequest::QTY_EPSILON
          raise ArgumentError,
                "Cannot release #{qty} from reservation (held: #{held})"
        end

        apply_balance_delta!(reserved_delta: -qty)
        transfer_request.update!(reserved_quantity: held - qty)
      end

      private

      attr_reader :transfer_request, :source_stack

      def apply_balance_delta!(reserved_delta:)
        balance = find_or_init_balance!
        new_reserved = balance.reserved_quantity.to_f + reserved_delta

        if new_reserved < -TransferRequest::QTY_EPSILON
          raise ArgumentError, "Reservation would become negative"
        end

        if new_reserved > balance.quantity.to_f + TransferRequest::QTY_EPSILON
          raise ArgumentError, "Reservation exceeds on-hand quantity on source stack"
        end

        balance.reserved_quantity = [new_reserved, 0].max
        balance.save!
      end

      def find_or_init_balance!
        stack = source_stack
        balance = StockBalance.find_or_initialize_by(
          stack: stack,
          commodity: stack.commodity,
          store: stack.store,
          warehouse: stack.store.warehouse,
          unit: stack.unit
        )

        if balance.new_record?
          balance.quantity = stack.quantity
          balance.reserved_quantity = 0
          balance.available_quantity = stack.quantity.to_f
        end

        balance
      end
    end
  end
end
