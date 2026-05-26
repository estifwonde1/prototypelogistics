# frozen_string_literal: true

module Cats
  module Warehouse
    class GinConfirmer
      def initialize(gin:, approved_by: nil, idempotency_key: nil)
        @gin = gin
        @approved_by = approved_by
        @idempotency_key = idempotency_key.presence
      end

      def call
        return @gin if idempotent_replay?

        @gin.ensure_confirmable!

        Gin.transaction do
          @gin.lock!

          return @gin.reload if idempotent_replay?

          old_status = @gin.status
          @gin.update!(
            status: :confirmed,
            approved_by: @approved_by || @gin.approved_by,
            workflow_status: "confirmed"
          )

          @gin.gin_items.find_each do |item|
            InventoryLedger.apply_issue!(
              warehouse: @gin.warehouse,
              item: item,
              transaction_date: @gin.issued_on,
              reference: @gin
            )

            matching_reservations = StockReservation.where(
              dispatch_order_id: @gin.dispatch_order_id,
              warehouse_id: @gin.warehouse_id,
              store_id: item.store_id,
              stack_id: item.stack_id,
              commodity_id: item.commodity_id,
              unit_id: item.unit_id,
              inventory_lot_id: item.inventory_lot_id
            )

            matching_reservations.find_each do |reservation|
              reservation.issued_quantity = reservation.issued_quantity.to_f + item.quantity.to_f
              reservation.status = "Consumed" if reservation.issued_quantity.to_f >= reservation.reserved_quantity.to_f
              reservation.save!
            end
          end

          if @gin.dispatch_order_authorization.present?
            auth = @gin.dispatch_order_authorization
            complete_authorization_if_done!(auth)
            DispatchOrderStatusAggregator.call(@gin.dispatch_order) if @gin.dispatch_order.present?
          elsif @gin.dispatch_order.present?
            order_old_status = @gin.dispatch_order.status
            @gin.dispatch_order.update!(status: ContractConstants::DOCUMENT_STATUSES[:completed])
            WorkflowEventRecorder.record!(
              entity: @gin.dispatch_order,
              event_type: "dispatch_order.completed",
              actor: @approved_by || @gin.approved_by,
              from_status: order_old_status,
              to_status: @gin.dispatch_order.status,
              payload: { gin_id: @gin.id }
            )
          end

          WorkflowEventRecorder.record!(
            entity: @gin,
            event_type: "gin.confirmed",
            actor: @approved_by || @gin.approved_by,
            from_status: old_status,
            to_status: @gin.status,
            payload: workflow_payload
          )

          enqueue_notification("gin.confirmed", gin_id: @gin.id)

          @gin
        end
      end

      private

      def idempotent_replay?
        return false if @idempotency_key.blank?

        @gin.status_confirmed? &&
          WorkflowEvent.where(entity: @gin, event_type: "gin.confirmed")
            .where("payload->>'idempotency_key' = ?", @idempotency_key)
            .exists?
      end

      def workflow_payload
        base = { gin_id: @gin.id }
        base["idempotency_key"] = @idempotency_key if @idempotency_key.present?
        base
      end

      def enqueue_notification(event, payload)
        NotificationFanout.deliver(event, payload)
      end

      # Mark all draft executions linked to this GIN's authorization as confirmed,
      # then check whether the authorization itself is fully done.
      # An authorization is complete when every store row has remaining_quantity == 0
      # (either fully dispatched or shortage accepted).
      def complete_authorization_if_done!(auth)
        # Confirm any draft executions that belong to this authorization
        auth.dispatch_order_authorization_executions
            .where(status: DispatchOrderAuthorizationExecution::DRAFT)
            .update_all(status: DispatchOrderAuthorizationExecution::CONFIRMED)

        # Authorization is complete when no store row has remaining quantity
        all_stores_done = auth.dispatch_order_authorization_stores
                              .where("remaining_quantity > 0.0001")
                              .none?

        return unless all_stores_done || auth.remaining_quantity.to_f <= 0.001

        return if auth.completed?

        auth.update!(status: DispatchOrderAuthorization::COMPLETED)
        WorkflowEventRecorder.record!(
          entity: auth,
          event_type: "dispatch_order_authorization.completed",
          actor: @approved_by || @gin.approved_by,
          from_status: DispatchOrderAuthorization::IN_PROGRESS,
          to_status: DispatchOrderAuthorization::COMPLETED,
          payload: { gin_id: @gin.id }
        )
      end
    end
  end
end
