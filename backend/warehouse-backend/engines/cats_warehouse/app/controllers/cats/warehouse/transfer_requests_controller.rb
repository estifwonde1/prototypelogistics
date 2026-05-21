# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestsController < BaseController
      include FilterValidation

      def index
        authorize TransferRequest

        requests = policy_scope(TransferRequest)
                   .includes(:source_store, :destination_store, :source_stack, :destination_stack,
                             :commodity, :unit, :entered_unit, :requested_by, :reviewed_by,
                             allocations: [:entered_unit, :destination_stack, :stack_transaction, :reviewed_by,
                                           { destination_stack: :store },
                                           { transfer_request: :source_stack }])
                   .order(created_at: :desc)

        begin
          status = validate_status_param(:status, TransferRequest::STATUSES)
          requests = requests.where(status: status) if status.present?
        rescue ArgumentError => e
          return render_error(e.message, status: :bad_request)
        end

        render_resource(requests, each_serializer: TransferRequestSerializer)
      end

      def show
        request = policy_scope(TransferRequest)
                  .includes(:source_store, :destination_store, :source_stack, :destination_stack,
                            :commodity, :unit, :entered_unit, :requested_by, :reviewed_by,
                            allocations: [:entered_unit, :destination_stack, :stack_transaction, :reviewed_by,
                                          { destination_stack: :store },
                                          { transfer_request: :source_stack }])
                  .find(params[:id])
        authorize request
        render_resource(request, serializer: TransferRequestSerializer)
      end

      def create
        authorize TransferRequest

        source_stack = Stack.find(params[:source_stack_id])
        destination_store = Store.find(params[:destination_store_id])

        unless policy_scope(Stack).exists?(id: source_stack.id)
          return render_error("You don't have access to the source stack", status: :forbidden)
        end

        unless source_stack.store.warehouse_id == destination_store.warehouse_id
          return render_error("Stores must be in the same warehouse", status: :unprocessable_entity)
        end

        resolved = TransferQuantityResolver.resolve(
          source_stack: source_stack,
          quantity: params[:quantity],
          entered_unit_id: params[:entered_unit_id],
          entered_quantity: params[:entered_quantity]
        )

        package_count = params[:package_count].present? ? params[:package_count].to_f : nil

        transfer_request = nil
        ActiveRecord::Base.transaction do
          transfer_request = TransferRequest.create!(
            source_store: source_stack.store,
            destination_store: destination_store,
            source_stack: source_stack,
            commodity: source_stack.commodity,
            unit: source_stack.unit,
            quantity: resolved.canonical_quantity,
            entered_unit_id: resolved.entered_unit_id,
            entered_quantity: resolved.entered_quantity,
            package_count: package_count,
            reason: params[:reason],
            requested_by: current_user,
            warehouse: source_stack.store.warehouse,
            status: "Pending"
          )

          TransferRequestStockHold.reserve!(transfer_request)
        end

        render_resource(transfer_request.reload, status: :created, serializer: TransferRequestSerializer)
      rescue ArgumentError => e
        render_error(e.message, status: :unprocessable_entity)
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.record.errors.full_messages.to_sentence, status: :unprocessable_entity)
      end

      def approve
        transfer_request = policy_scope(TransferRequest).lock.find(params[:id])
        authorize transfer_request, :approve?

        unless transfer_request.open?
          return render_error(
            "Request is not open for fulfillment (status: #{transfer_request.status})",
            status: :unprocessable_entity
          )
        end

        destination_stack = resolve_approval_destination_stack(transfer_request)
        tranche = resolve_approval_tranche!(transfer_request)

        result = nil
        ActiveRecord::Base.transaction do
          transfer_request.approve!(
            current_user,
            destination_stack_id: destination_stack&.id,
            notes: params[:notes]
          )

          result = TransferRequestExecutor.call(
            transfer_request: transfer_request.reload,
            user: current_user,
            destination_stack: destination_stack,
            quantity: tranche[:canonical_quantity],
            entered_unit_id: tranche[:entered_unit_id],
            entered_quantity: tranche[:entered_quantity],
            package_count: tranche[:package_count]
          )

          TransferRequestStockHold.consume_for_transfer!(
            transfer_request.reload,
            tranche[:canonical_quantity]
          )

          create_allocation!(
            transfer_request: transfer_request,
            action: "fulfillment",
            quantity: tranche[:canonical_quantity],
            entered_unit_id: tranche[:entered_unit_id],
            entered_quantity: tranche[:entered_quantity],
            package_count: tranche[:package_count],
            destination_stack: result.destination_stack,
            stack_transaction: result.transaction,
            notes: params[:notes]
          )

          transfer_request.record_fulfillment!(
            tranche[:canonical_quantity],
            reviewed_by_user: current_user,
            notes: params[:notes],
            destination_stack_id: result.destination_stack&.id
          )
        end

        render_resource(transfer_request.reload, serializer: TransferRequestSerializer)
      rescue Pundit::NotAuthorizedError, ActiveRecord::RecordNotFound => e
        raise e
      rescue StandardError => e
        Rails.logger.error("Failed to approve transfer request: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
        render_error(e.message, status: :unprocessable_entity)
      end

      def reject
        transfer_request = policy_scope(TransferRequest).lock.find(params[:id])
        authorize transfer_request, :reject?

        unless params[:notes].present?
          return render_error("Rejection notes are required", status: :unprocessable_entity)
        end

        unless transfer_request.open?
          return render_error(
            "Request is not open for rejection (status: #{transfer_request.status})",
            status: :unprocessable_entity
          )
        end

        reject_qty = resolve_rejection_quantity!(transfer_request)

        ActiveRecord::Base.transaction do
          create_allocation!(
            transfer_request: transfer_request,
            action: "rejection",
            quantity: reject_qty,
            notes: params[:notes]
          )

          TransferRequestStockHold.release!(transfer_request.reload, reject_qty)

          if transfer_request.fulfilled_quantity.to_f <= TransferRequest::QTY_EPSILON &&
             reject_qty >= transfer_request.quantity.to_f - TransferRequest::QTY_EPSILON
            transfer_request.reject_all!(current_user, notes: params[:notes])
          else
            transfer_request.record_rejection!(reject_qty, reviewed_by_user: current_user, notes: params[:notes])
          end
        end

        render_resource(transfer_request.reload, serializer: TransferRequestSerializer)
      rescue Pundit::NotAuthorizedError, ActiveRecord::RecordNotFound => e
        raise e
      rescue StandardError => e
        render_error(e.message, status: :unprocessable_entity)
      end

      private

      def resolve_approval_destination_stack(transfer_request)
        destination_stack_id = params[:destination_stack_id]
        return nil if destination_stack_id.blank?

        destination_stack = Stack.find_by(id: destination_stack_id)
        unless destination_stack.present?
          raise ArgumentError, "Destination stack not found"
        end

        unless destination_stack.store_id == transfer_request.destination_store_id
          raise ArgumentError, "Destination stack must be in the destination store"
        end

        if destination_stack.quantity.to_f.positive? &&
           destination_stack.commodity_id.present? &&
           destination_stack.commodity_id != transfer_request.commodity_id
          raise ArgumentError,
                "Destination stack holds a different commodity. Choose an empty bay or matching stack."
        end

        destination_stack
      end

      def resolve_approval_tranche!(transfer_request)
        source_stack = transfer_request.source_stack

        unless approval_override_params?
          raise ArgumentError, "Quantity is required for each fulfillment"
        end

        resolved = TransferQuantityResolver.resolve(
          source_stack: source_stack,
          quantity: params[:quantity],
          entered_unit_id: params[:entered_unit_id],
          entered_quantity: params[:entered_quantity]
        )

        package_count = params[:package_count].present? ? params[:package_count].to_f : nil

        {
          canonical_quantity: resolved.canonical_quantity,
          entered_unit_id: resolved.entered_unit_id,
          entered_quantity: resolved.entered_quantity,
          package_count: package_count
        }
      end

      def resolve_rejection_quantity!(transfer_request)
        remaining = transfer_request.remaining_quantity
        return remaining unless params[:quantity].present? || params[:entered_quantity].present?

        source_stack = transfer_request.source_stack
        resolved = TransferQuantityResolver.resolve(
          source_stack: source_stack,
          quantity: params[:quantity],
          entered_unit_id: params[:entered_unit_id] || transfer_request.entered_unit_id,
          entered_quantity: params[:entered_quantity]
        )
        resolved.canonical_quantity
      end

      def approval_override_params?
        params[:entered_unit_id].present? ||
          params[:entered_quantity].present? ||
          params[:quantity].present? ||
          params[:package_count].present?
      end

      def create_allocation!(transfer_request:, action:, quantity:, notes: nil,
                             entered_unit_id: nil, entered_quantity: nil, package_count: nil,
                             destination_stack: nil, stack_transaction: nil)
        transfer_request.allocations.create!(
          action: action,
          quantity: quantity,
          entered_unit_id: entered_unit_id,
          entered_quantity: entered_quantity,
          package_count: package_count,
          destination_stack: destination_stack,
          stack_transaction: stack_transaction,
          reviewed_by: current_user,
          notes: notes
        )
      end
    end
  end
end
