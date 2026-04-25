# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestsController < BaseController
      def index
        authorize TransferRequest
        
        requests = policy_scope(TransferRequest)
          .includes(:source_store, :destination_store, :source_stack, :destination_stack, :commodity, :unit, :requested_by, :reviewed_by)
          .order(created_at: :desc)

        # Filter by status if provided
        requests = requests.where(status: params[:status]) if params[:status].present?

        render_resource(requests, each_serializer: TransferRequestSerializer)
      end

      def show
        request = policy_scope(TransferRequest).find(params[:id])
        authorize request
        render_resource(request, serializer: TransferRequestSerializer)
      end

      def create
        authorize TransferRequest

        source_stack = Stack.find(params[:source_stack_id])
        destination_store = Store.find(params[:destination_store_id])

        # Verify user has access to source stack
        unless policy_scope(Stack).exists?(id: source_stack.id)
          return render_error("You don't have access to the source stack", status: :forbidden)
        end

        # Verify stores are in the same warehouse
        unless source_stack.store.warehouse_id == destination_store.warehouse_id
          return render_error("Stores must be in the same warehouse", status: :unprocessable_entity)
        end

        transfer_request = TransferRequest.new(
          source_store: source_stack.store,
          destination_store: destination_store,
          source_stack: source_stack,
          commodity: source_stack.commodity,
          unit: source_stack.unit,
          quantity: params[:quantity],
          reason: params[:reason],
          requested_by: current_user,
          warehouse: source_stack.store.warehouse,
          status: "Pending"
        )

        if transfer_request.save
          render_resource(transfer_request, status: :created, serializer: TransferRequestSerializer)
        else
          render_error(transfer_request.errors.full_messages.to_sentence, status: :unprocessable_entity)
        end
      end

      def approve
        # Use pessimistic locking to prevent race conditions
        transfer_request = policy_scope(TransferRequest).lock.find(params[:id])
        authorize transfer_request, :approve?

        # Log current status for debugging
        Rails.logger.info("Attempting to approve transfer request #{transfer_request.id} with status: #{transfer_request.status}")

        destination_stack_id = params[:destination_stack_id]
        destination_stack = nil

        # If destination stack provided, verify it exists and is in the destination store
        if destination_stack_id.present?
          destination_stack = Stack.find_by(id: destination_stack_id)
          unless destination_stack.present?
            return render_error("Destination stack not found", status: :not_found)
          end

          unless destination_stack.store_id == transfer_request.destination_store_id
            return render_error("Destination stack must be in the destination store", status: :unprocessable_entity)
          end

          unless destination_stack.commodity_id == transfer_request.commodity_id
            return render_error("Destination stack must have the same commodity", status: :unprocessable_entity)
          end
        end

        # Wrap in transaction to ensure atomicity
        ActiveRecord::Base.transaction do
          transfer_request.approve!(
            current_user,
            destination_stack_id: destination_stack_id,
            notes: params[:notes]
          )

          # Always execute the transfer (auto-create destination stack if not provided)
          execute_transfer(transfer_request)
        end

        render_resource(transfer_request, serializer: TransferRequestSerializer)
      rescue Pundit::NotAuthorizedError, ActiveRecord::RecordNotFound => e
        raise e
      rescue StandardError => e
        Rails.logger.error("Failed to approve transfer request: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
        render_error(e.message, status: :unprocessable_entity)
      end

      def reject
        transfer_request = policy_scope(TransferRequest).find(params[:id])
        authorize transfer_request, :reject?

        unless params[:notes].present?
          return render_error("Rejection notes are required", status: :unprocessable_entity)
        end

        transfer_request.reject!(current_user, notes: params[:notes])

        render_resource(transfer_request, serializer: TransferRequestSerializer)
      rescue Pundit::NotAuthorizedError, ActiveRecord::RecordNotFound => e
        raise e
      rescue StandardError => e
        render_error(e.message, status: :unprocessable_entity)
      end

      private

      def execute_transfer(transfer_request)
        source_stack = transfer_request.source_stack
        destination_stack = transfer_request.destination_stack

        # Create destination stack if not provided (auto-select/create)
        unless destination_stack.present?
          # Try to find an existing stack with same commodity in destination store
          destination_stack = Stack.find_by(
            store: transfer_request.destination_store,
            commodity: transfer_request.commodity,
            unit: transfer_request.unit
          )

          # If no existing stack found, create a new one
          unless destination_stack.present?
            destination_stack = Stack.create!(
              store: transfer_request.destination_store,
              commodity: transfer_request.commodity,
              unit: transfer_request.unit,
              quantity: 0,
              length: source_stack.length,
              width: source_stack.width,
              height: source_stack.height,
              code: "#{transfer_request.destination_store.code}-#{transfer_request.commodity.batch_no}-#{Time.current.to_i}"
            )
          end

          transfer_request.update!(destination_stack: destination_stack)
        end

        # Debit source stack
        source_stack.quantity -= transfer_request.quantity
        source_stack.save!

        # Credit destination stack
        destination_stack.quantity += transfer_request.quantity
        destination_stack.save!

        # Create stack transaction
        StackTransaction.create!(
          source: source_stack,
          destination: destination_stack,
          quantity: transfer_request.quantity,
          unit: transfer_request.unit,
          transaction_date: Time.current,
          reference: transfer_request
        )

        # Update stock balances
        update_stock_balance(source_stack, -transfer_request.quantity)
        update_stock_balance(destination_stack, transfer_request.quantity)

        # Mark request as completed
        transfer_request.complete!

        # Create workflow event
        WorkflowEvent.create!(
          entity: transfer_request,
          event_type: "transfer_request_completed",
          actor_id: current_user.id,
          occurred_at: Time.current,
          payload: {
            transfer_request_id: transfer_request.id,
            source_stack_id: source_stack.id,
            destination_stack_id: destination_stack.id,
            quantity: transfer_request.quantity
          }
        )
      rescue StandardError => e
        Rails.logger.error("Failed to execute transfer: #{e.message}")
        raise
      end

      def update_stock_balance(stack, quantity_change)
        balance = StockBalance.find_or_initialize_by(
          stack: stack,
          commodity: stack.commodity,
          store: stack.store,
          warehouse: stack.store.warehouse,
          unit: stack.unit
        )

        balance.quantity = stack.quantity # Use the updated stack quantity directly
        balance.save!
      end
    end
  end
end
