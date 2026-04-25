# frozen_string_literal: true

module Cats
  module Warehouse
    class StackTransferService
      attr_reader :source_stack, :destination_stack, :quantity, :user

      def initialize(source_stack:, destination_stack:, quantity:, user:)
        @source_stack = source_stack
        @destination_stack = destination_stack
        @quantity = quantity.to_f
        @user = user
      end

      def call
        validate!
        transfer!
      end

      private

      def validate!
        # Validate same store
        unless source_stack.store_id == destination_stack.store_id
          raise ArgumentError, "Source and destination stacks must be in the same store"
        end

        # Validate same commodity
        unless source_stack.commodity_id == destination_stack.commodity_id
          raise ArgumentError, "Source and destination stacks must have the same commodity"
        end

        # Validate same unit
        unless source_stack.unit_id == destination_stack.unit_id
          raise ArgumentError, "Source and destination stacks must have the same unit"
        end

        # Validate sufficient quantity
        if source_stack.quantity < quantity
          raise ArgumentError, "Insufficient quantity in source stack. Available: #{source_stack.quantity}, Requested: #{quantity}"
        end

        # Validate positive quantity
        if quantity <= 0
          raise ArgumentError, "Transfer quantity must be greater than zero"
        end
      end

      def transfer!
        ActiveRecord::Base.transaction do
          # Debit source stack
          source_stack.quantity -= quantity
          source_stack.save!

          # Credit destination stack
          destination_stack.quantity += quantity
          destination_stack.save!

          # Create stack transaction
          transaction_attrs = {
            source: source_stack,
            destination: destination_stack,
            quantity: quantity,
            unit: source_stack.unit,
            transaction_date: Time.current
          }

          transaction = StackTransaction.create!(transaction_attrs)

          # Update stock balances
          update_stock_balance(source_stack, -quantity)
          update_stock_balance(destination_stack, quantity)

          # Create workflow event for audit trail
          create_workflow_event(transaction)

          transaction
        end
      end

      def conversion_factor
        # If base_unit is present, calculate conversion factor
        return 1.0 unless source_stack.base_unit.present?

        # This should ideally come from a UOM conversion table
        # For now, we'll use a simple 1:1 ratio
        1.0
      end

      def update_stock_balance(stack, quantity_change)
        balance = StockBalance.find_or_initialize_by(
          stack: stack,
          commodity: stack.commodity,
          store: stack.store,
          warehouse: stack.store.warehouse,
          unit: stack.unit
        )

        balance.quantity ||= stack.quantity
        balance.quantity = stack.quantity # Use the updated stack quantity directly
        balance.save!
      end

      def create_workflow_event(transaction)
        WorkflowEvent.create!(
          event_type: "stack_transfer",
          actor_id: user.id,
          occurred_at: Time.current,
          metadata: {
            source_stack_id: source_stack.id,
            destination_stack_id: destination_stack.id,
            quantity: quantity,
            unit_id: source_stack.unit_id,
            transaction_id: transaction.id
          }
        )
      rescue StandardError => e
        # Log error but don't fail the transaction
        Rails.logger.error("Failed to create workflow event: #{e.message}")
      end
    end
  end
end
