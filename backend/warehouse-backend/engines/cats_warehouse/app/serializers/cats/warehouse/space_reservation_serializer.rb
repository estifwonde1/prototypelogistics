module Cats
  module Warehouse
    class SpaceReservationSerializer < ApplicationSerializer
      attributes :id, :receipt_order_id, :receipt_order_line_id, :receipt_order_assignment_id, :warehouse_id,
                 :warehouse_name, :store_id, :store_name, :reserved_quantity, :reserved_volume, :status,
                 :reserved_by_id, :reserved_by_name, :reserved_at, :created_at, :updated_at

      def warehouse_name
        object.warehouse&.name
      end

      def store_name
        object.store&.name
      end

      def reserved_by_name
        user = object.reserved_by
        return unless user

        [ user.first_name, user.last_name ].compact.join(" ").strip.presence || user.email
      end

      # Frontend expects `reserved_at`, but backend stores it as `created_at`.
      def reserved_at
        object.created_at&.iso8601
      end
    end
  end
end
