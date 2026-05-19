# frozen_string_literal: true

module Cats
  module Warehouse
    class ReceiptAuthorizationStorekeeperAssigner
      def self.call(receipt_authorization:, actor:, storekeeper_user_id:, store_id: nil)
        new(
          receipt_authorization: receipt_authorization,
          actor:                 actor,
          storekeeper_user_id:   storekeeper_user_id,
          store_id:              store_id
        ).call
      end

      def initialize(receipt_authorization:, actor:, storekeeper_user_id:, store_id: nil)
        @ra = receipt_authorization
        @actor = actor
        @storekeeper_user_id = storekeeper_user_id.to_i
        @store_id = store_id.presence&.to_i
      end

      def call
        validate_assignable!
        storekeeper = resolve_storekeeper!
        store = resolve_store!(storekeeper)

        @ra.update!(
          assigned_storekeeper_id:    storekeeper.id,
          assigned_storekeeper_by_id: @actor.id,
          assigned_storekeeper_at:    Time.current,
          store_id:                   store&.id
        )

        NotificationFanout.deliver(
          "receipt_authorization.assigned_to_storekeeper",
          receipt_authorization_id: @ra.id,
          receipt_order_id:         @ra.receipt_order_id,
          storekeeper_user_id:        storekeeper.id,
          warehouse_id:             @ra.warehouse_id,
          store_id:                   store&.id
        )

        @ra.reload
      end

      private

      def validate_assignable!
        unless @ra.pending? || @ra.active?
          raise ArgumentError, "Receipt Authorization must be pending or active to assign a storekeeper"
        end

        if @ra.inspections.exists?
          raise ArgumentError, "Cannot assign or reassign after an inspection has been recorded"
        end
      end

      def resolve_storekeeper!
        user = Cats::Core::User.find(@storekeeper_user_id)
        warehouse_id = @ra.warehouse_id
        store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)

        eligible =
          UserAssignment.where(user_id: user.id, role_name: "Storekeeper").where(
            "warehouse_id = ? OR store_id IN (?)",
            warehouse_id,
            store_ids.presence || [0]
          ).exists?

        raise ArgumentError, "User is not a storekeeper for this warehouse" unless eligible

        user
      end

      def resolve_store!(storekeeper)
        if @store_id.present?
          store = Store.find(@store_id)
          unless store.warehouse_id == @ra.warehouse_id
            raise ArgumentError, "Store does not belong to this receipt authorization warehouse"
          end
          return store
        end

        assignment = UserAssignment.where(user_id: storekeeper.id, role_name: "Storekeeper")
                                     .where(store_id: Store.where(warehouse_id: @ra.warehouse_id).select(:id))
                                     .first
        return assignment.store if assignment&.store_id.present?

        nil
      end
    end
  end
end
