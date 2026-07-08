module Cats
  module Warehouse
    class NotificationsController < BaseController
      def index
        authorize InAppNotification

        scope = policy_scope(InAppNotification).order(created_at: :desc)
        scope = apply_warehouse_context(scope)
        scope = scope.unread if ActiveModel::Type::Boolean.new.cast(params[:unread])

        limit = [ params.fetch(:limit, 30).to_i, 100 ].min
        offset = [ params.fetch(:offset, 0).to_i, 0 ].max

        notifications = scope.limit(limit).offset(offset)
        render_resource(notifications, each_serializer: InAppNotificationSerializer)
      end

      def unread_count
        authorize InAppNotification, :unread_count?, policy_class: InAppNotificationPolicy

        count = apply_warehouse_context(policy_scope(InAppNotification)).unread.count
        render_success(count: count)
      end

      def mark_read
        notification = policy_scope(InAppNotification).find(params[:id])
        authorize notification, :mark_read?, policy_class: InAppNotificationPolicy

        notification.mark_read!
        render_resource(notification, serializer: InAppNotificationSerializer)
      end

      def read_all
        authorize InAppNotification, :read_all?, policy_class: InAppNotificationPolicy

        now = Time.current
        policy_scope(InAppNotification).unread.update_all(read_at: now, updated_at: now)
        render_success
      end

      private

      def apply_warehouse_context(scope)
        return scope unless params[:warehouse_id].present?

        warehouse_id = params[:warehouse_id].to_i
        access = AccessContext.new(user: current_user)
        unless warehouse_id_values(access.accessible_warehouse_ids).include?(warehouse_id)
          raise Pundit::NotAuthorizedError, "Access denied to warehouse #{warehouse_id}"
        end

        store_ids = Store.where(warehouse_id: warehouse_id).pluck(:id)
        scope.where(
          "params ->> 'warehouse_id' = :warehouse_id OR params ->> 'store_id' IN (:store_ids)",
          warehouse_id: warehouse_id.to_s,
          store_ids: store_ids.map(&:to_s).presence || [ "0" ]
        )
      end

      def warehouse_id_values(raw)
        if raw.is_a?(Array)
          raw.map { |v| v.is_a?(Integer) ? v : v.try(:id) }.compact.map(&:to_i)
        else
          raw.pluck(:id).map(&:to_i)
        end
      end
    end
  end
end
