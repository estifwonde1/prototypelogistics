# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderSerializer < ApplicationSerializer
      attributes :id, :reference_no, :plan_reference, :name, :status, :status_label,
                 :dispatched_date, :destination_type, :destination_id, :destination_reference,
                 :hub_id, :hub_name, :warehouse_id, :warehouse_name, :warehouse_code,
                 :created_by_id, :created_by_name, :confirmed_by_id, :confirmed_by_name,
                 :confirmed_at, :approved_by_id, :approved_at,
                 :description, :created_at, :updated_at,
                 :location_id, :hierarchical_level, :officer_level, :officer_location_id,
                 :location_name, :exchange_order, :dispatch_plan_id, :dispatch_plan_item_id

      has_many :dispatch_order_lines, serializer: DispatchOrderLineSerializer
      has_many :dispatch_order_assignments, serializer: DispatchOrderAssignmentSerializer
      has_many :stock_reservations, serializer: StockReservationSerializer
      has_many :dispatch_order_authorizations, serializer: DispatchOrderAuthorizationSerializer

      def status_label
        object.status.to_s.titleize
      end

      def exchange_order
        object.exchange_order?
      end

      def destination_reference
        return unless object.destination.present?

        object.destination.respond_to?(:reference_no) ? object.destination.reference_no : object.destination.id
      end

      def hub_name
        object.hub&.name
      end

      def warehouse_name
        object.warehouse&.name
      end

      def warehouse_code
        object.warehouse&.code
      end

      def created_by_name
        user_display(object.created_by)
      end

      def confirmed_by_name
        user_display(object.confirmed_by)
      end

      private

      def user_display(user)
        return unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end
    end
  end
end
