module Cats
  module Warehouse
    class InAppNotificationPolicy < ApplicationPolicy
      class Scope < Scope
        def resolve
          return scope.none if user.blank?

          scope.where(recipient_type: user.class.name, recipient_id: user.id)
        end
      end

      def index?
        user.present?
      end

      def unread_count?
        index?
      end

      def read_all?
        index?
      end

      def mark_read?
        return false unless record.is_a?(InAppNotification)

        record.recipient_type == user.class.name && record.recipient_id == user.id
      end
    end
  end
end
