module Cats
  module Warehouse
    class DispatchOrderAssignmentSerializer < ApplicationSerializer
      attributes :id, :dispatch_order_id, :dispatch_order_line_id,
                 :hub_id, :hub_name, :warehouse_id, :warehouse_name,
                 :store_id, :store_name, :assigned_by_id, :assigned_by_name,
                 :assigned_to_id, :assigned_to_name, :quantity, :status,
                 :assigned_at, :created_at, :updated_at,
                 :reference_no, :commodity_name, :commodity_quantity, :unit_name

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

      def reference_no
        object.dispatch_order&.reference_no
      end

      def commodity_name
        object.dispatch_order_line&.commodity&.name
      end

      def commodity_quantity
        object.dispatch_order_line&.quantity
      end

      def unit_name
        object.dispatch_order_line&.unit&.name
      end

      private

      def user_display_name(user)
        return if user.blank?

        [ user.first_name, user.last_name ].compact.join(" ").strip.presence || user.email
      end
    end
  end
end
