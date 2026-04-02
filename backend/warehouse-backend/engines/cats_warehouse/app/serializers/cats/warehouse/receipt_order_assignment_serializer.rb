module Cats
  module Warehouse
    class ReceiptOrderAssignmentSerializer < ApplicationSerializer
      attributes :id, :receipt_order_id, :receipt_order_line_id, :hub_id, :hub_name, :warehouse_id, :warehouse_name,
                 :store_id, :store_name, :assigned_by_id, :assigned_by_name, :assigned_to_id, :assigned_to_name,
                 :quantity, :status, :assigned_at, :created_at, :updated_at

      def hub_name
        object.hub&.name
      end

      def warehouse_name
        object.warehouse&.name
      end

      def store_name
        object.store&.name
      end

      def assigned_to_name
        user_display_name(object.assigned_to)
      end

      def assigned_by_name
        user_display_name(object.assigned_by)
      end

      def assigned_at
        object.created_at&.iso8601
      end

      private

      def user_display_name(user)
        return if user.blank?

        [ user.first_name, user.last_name ].compact.join(" ").strip.presence || user.email
      end
    end
  end
end
