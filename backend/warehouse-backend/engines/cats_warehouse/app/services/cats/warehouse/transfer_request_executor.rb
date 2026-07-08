# frozen_string_literal: true

module Cats
  module Warehouse
    # Executes approved store-to-store transfer requests (cross-store).
    class TransferRequestExecutor
      attr_reader :transfer_request, :source_stack, :destination_stack, :user,
                  :quantity, :entered_unit_id, :entered_quantity, :package_count,
                  :destination_credit_quantity, :transaction

      def self.call(**kwargs)
        new(**kwargs).call
      end

      def initialize(
        transfer_request:,
        user:,
        destination_stack: nil,
        quantity: nil,
        entered_unit_id: nil,
        entered_quantity: nil,
        package_count: nil
      )
        @transfer_request = transfer_request
        @user = user
        @source_stack = transfer_request.source_stack.reload
        @package_count = package_count.present? ? package_count.to_f : transfer_request.package_count

        resolved = TransferQuantityResolver.resolve(
          source_stack: source_stack,
          quantity: quantity || transfer_request.quantity,
          entered_unit_id: entered_unit_id || transfer_request.entered_unit_id,
          entered_quantity: entered_quantity || transfer_request.entered_quantity
        )
        @quantity = resolved.canonical_quantity
        @entered_unit_id = resolved.entered_unit_id
        @entered_quantity = resolved.entered_quantity

        @destination_stack =
          destination_stack ||
          StackMovementHelper.resolve_destination_stack_for_transfer_request(
            transfer_request,
            source_stack: source_stack
          )
      end

      def call
        validate!
        destination_stack.reload
        @destination_credit_quantity = StackMovementHelper.compute_destination_credit_quantity(
          source_stack: source_stack,
          destination_stack: destination_stack,
          quantity_in_source_unit: quantity
        )
        execute!
        self
      end

      private

      def validate!
        unless source_stack.unit_id.present?
          raise ArgumentError, "Source stack has no unit of measure"
        end

        StackMovementHelper.prepare_destination_to_receive_goods!(
          source_stack: source_stack,
          destination_stack: destination_stack
        )

        if StackMovementHelper.destination_has_different_commodity_with_stock?(
          source_stack: source_stack,
          destination_stack: destination_stack
        )
          raise ArgumentError, "Destination stack holds a different commodity. Choose an empty bay or matching stack."
        end

        unless StackMovementHelper.same_commodity?(source_stack: source_stack, destination_stack: destination_stack)
          raise ArgumentError, "Source and destination stacks must have the same commodity"
        end

        StackMovementHelper.ensure_destination_unit!(source_stack: source_stack, destination_stack: destination_stack)

        remaining = transfer_request.remaining_quantity
        if quantity > remaining + TransferRequest::QTY_EPSILON
          raise ArgumentError,
                "Quantity (#{quantity}) exceeds remaining on request (#{remaining})"
        end

        if source_stack.quantity < quantity
          raise ArgumentError,
                "Insufficient quantity in source stack. Available: #{source_stack.quantity}, Requested: #{quantity}"
        end

        raise ArgumentError, "Transfer quantity must be greater than zero" if quantity <= 0
      end

      def execute!
        ActiveRecord::Base.transaction do
          source_stack.quantity -= quantity
          source_stack.save!

          destination_stack.quantity += destination_credit_quantity
          destination_stack.save!

          transaction_attrs = {
            source: source_stack,
            destination: destination_stack,
            quantity: quantity,
            unit: source_stack.unit,
            transaction_date: Date.current,
            entered_unit_id: entered_unit_id,
            entered_quantity: entered_quantity,
            package_count: package_count,
            reference: transfer_request
          }

          if source_stack.base_unit_id.present?
            transaction_attrs[:base_unit_id] = source_stack.base_unit_id
            transaction_attrs[:base_quantity] = quantity
          end

          @transaction = StackTransaction.create!(transaction_attrs)

          StackMovementHelper.update_stock_balance!(source_stack)
          StackMovementHelper.update_stock_balance!(destination_stack)

          StoreOccupancyUpdater.call(store_id: source_stack.store_id)
          StoreOccupancyUpdater.call(store_id: destination_stack.store_id)

          create_workflow_event
        end
      end

      def create_workflow_event
        WorkflowEvent.create!(
          entity: transfer_request,
          event_type: "transfer_request_fulfillment",
          actor_id: user.id,
          occurred_at: Time.current,
          payload: {
            transfer_request_id: transfer_request.id,
            source_stack_id: source_stack.id,
            destination_stack_id: destination_stack.id,
            quantity: quantity,
            unit_id: source_stack.unit_id,
            destination_quantity: destination_credit_quantity,
            destination_unit_id: destination_stack.unit_id,
            entered_unit_id: entered_unit_id,
            entered_quantity: entered_quantity,
            package_count: package_count,
            transaction_id: transaction.id
          }
        )
      rescue StandardError => e
        Rails.logger.error("Failed to create transfer request workflow event: #{e.message}")
      end
    end
  end
end
