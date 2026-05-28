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
        return @gin.reload if @gin.status_confirmed?

        return @gin if idempotent_replay?

        ensure_stack_allocations_present!

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

          issue_inventory!

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

      def ensure_stack_allocations_present!
        return unless @gin.dispatch_order_authorization_id.present?

        return if @gin.dispatch_stack_allocations.exists?

        raise ArgumentError, "Stack allocations are required before confirming this GIN"
      end

      def issue_inventory!
        if @gin.dispatch_stack_allocations.exists?
          @gin.dispatch_stack_allocations.includes(stack: :store).find_each do |alloc|
            base_item = base_gin_item_for_allocation(alloc)
            issue_item = build_issue_item_from_allocation(base_item, alloc)
            apply_issue_and_reservations!(issue_item)
          end
        else
          @gin.gin_items.find_each do |item|
            apply_issue_and_reservations!(item)
          end
        end
      end

      def apply_issue_and_reservations!(item)
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

      def base_gin_item_for_allocation(alloc)
        execution = alloc.dispatch_order_authorization_execution
        commodity_id = execution&.commodity_id
        @gin.gin_items.find_by(commodity_id: commodity_id) || @gin.gin_items.first
      end

      def build_issue_item_from_allocation(base_item, alloc)
        stack = alloc.stack
        store = stack.store
        stack_commodity_id = resolve_stack_commodity_id(stack, base_item.commodity_id)
        balance = StockBalance.find_by(
          warehouse_id: @gin.warehouse_id,
          store_id: store.id,
          stack_id: stack.id,
          commodity_id: stack_commodity_id
        )
        unit_id = balance&.unit_id || base_item.unit_id
        lot_id = base_item.inventory_lot_id
        lot_id ||= infer_inventory_lot_for_issue(
          warehouse: @gin.warehouse,
          commodity_id: stack_commodity_id,
          unit_id: unit_id,
          store_id: store.id,
          stack_id: stack.id
        )

        commodity = Cats::Core::Commodity.find_by(id: stack_commodity_id) || base_item.commodity

        GinItem.new(
          gin: @gin,
          commodity_id: stack_commodity_id,
          commodity: commodity,
          quantity: alloc.quantity,
          unit_id: unit_id,
          entered_unit_id: base_item.entered_unit_id || unit_id,
          base_unit_id: base_item.base_unit_id,
          base_quantity: alloc.base_quantity || alloc.quantity,
          store_id: store.id,
          stack_id: stack.id,
          inventory_lot_id: lot_id
        )
      end

      def resolve_stack_commodity_id(stack, fallback_commodity_id)
        balance = StockBalance
          .where(warehouse_id: @gin.warehouse_id, stack_id: stack.id)
          .where("COALESCE(available_quantity, quantity) > 0")
          .order(updated_at: :desc)
          .first
        return balance.commodity_id if balance&.commodity_id.present?

        stack.commodity_id.presence || fallback_commodity_id
      end

      def infer_inventory_lot_for_issue(warehouse:, commodity_id:, unit_id:, store_id:, stack_id:)
        lot_ids = StockBalance.where(
          warehouse_id: warehouse.id,
          store_id: store_id,
          stack_id: stack_id,
          commodity_id: commodity_id,
          unit_id: unit_id
        ).where("quantity > 0").where.not(inventory_lot_id: nil).distinct.pluck(:inventory_lot_id)

        lot_ids.one? ? lot_ids.first : nil
      end

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

      def complete_authorization_if_done!(auth)
        auth.dispatch_order_authorization_executions
            .where(status: DispatchOrderAuthorizationExecution::DRAFT)
            .update_all(status: DispatchOrderAuthorizationExecution::CONFIRMED)

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
