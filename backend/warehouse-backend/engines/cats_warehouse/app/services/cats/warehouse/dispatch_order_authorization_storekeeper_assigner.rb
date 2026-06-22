# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationStorekeeperAssigner
      def self.call(dispatch_order_authorization:, actor:, storekeeper_user_id:, store_id: nil)
        new(
          dispatch_order_authorization: dispatch_order_authorization,
          actor:                        actor,
          storekeeper_user_id:          storekeeper_user_id,
          store_id:                     store_id
        ).call
      end

      def initialize(dispatch_order_authorization:, actor:, storekeeper_user_id:, store_id: nil)
        @dao = dispatch_order_authorization
        @actor = actor
        @storekeeper_user_id = storekeeper_user_id.to_i
        @store_id = store_id.presence&.to_i
      end

      def call
        validate_assignable!
        storekeeper = resolve_storekeeper!
        store = resolve_store!(storekeeper)

        @dao.update!(
          assigned_storekeeper_id:    storekeeper.id,
          assigned_storekeeper_by_id: @actor.id,
          assigned_storekeeper_at:    Time.current,
          store_id:                   store&.id
        )

        # Notify storekeeper
        NotificationFanout.deliver(
          "dispatch_authorization.assigned_to_storekeeper",
          dispatch_order_authorization_id: @dao.id,
          dispatch_order_id:               @dao.dispatch_order_id,
          storekeeper_user_id:             storekeeper.id,
          warehouse_id:                    @dao.warehouse_id,
          store_id:                        store&.id
        )

        @dao.reload
      end

      private

      def validate_assignable!
        unless @dao.draft? || @dao.confirmed?
          raise ArgumentError, "Dispatch Authorization must be draft or confirmed to assign a storekeeper"
        end
      end

      def resolve_storekeeper!
        user = Cats::Core::User.find(@storekeeper_user_id)
        warehouse_id = @dao.warehouse_id
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
          unless store.warehouse_id == @dao.warehouse_id
            raise ArgumentError, "Store does not belong to this dispatch authorization warehouse"
          end
          return store
        end

        assignment = UserAssignment.where(user_id: storekeeper.id, role_name: "Storekeeper")
                                     .where(store_id: Store.where(warehouse_id: @dao.warehouse_id).select(:id))
                                     .first
        return assignment.store if assignment&.store_id.present?

        nil
      end
    end
  end
end
