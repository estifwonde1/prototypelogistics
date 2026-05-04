module Cats
  module Warehouse
    class NotificationsController < BaseController
      def index
        authorize InAppNotification

        scope = policy_scope(InAppNotification).order(created_at: :desc)
        scope = scope.unread if ActiveModel::Type::Boolean.new.cast(params[:unread])

        limit = [ params.fetch(:limit, 30).to_i, 100 ].min
        offset = [ params.fetch(:offset, 0).to_i, 0 ].max

        notifications = scope.limit(limit).offset(offset)
        render_resource(notifications, each_serializer: InAppNotificationSerializer)
      end

      def unread_count
        authorize InAppNotification, :unread_count?, policy_class: InAppNotificationPolicy

        count = policy_scope(InAppNotification).unread.count
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
    end
  end
end
