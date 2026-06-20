module Cats
  module Warehouse
    class DispatchOrderSerializer < ApplicationSerializer
      attributes :id, :reference_no, :name, :status, :dispatched_date, :destination_type, :destination_id, :destination_reference,
                 :hub_id, :hub_name, :warehouse_id, :warehouse_name, :warehouse_code,
                 :source_warehouse_id, :source_warehouse_name, :expected_pickup_date,
                 :created_by_id, :created_by_name, :confirmed_by_id, :confirmed_by_name, :confirmed_at,
                 :description, :created_at, :updated_at,
                 :location_id, :hierarchical_level, :location_name,
                 :response_plan_ref, :approval_date, :response_type, :fdp_id, :fdp_name,
                 :total_ordered_quantity, :total_authorized_quantity, :remaining_quantity

      has_many :dispatch_order_lines, serializer: Cats::Warehouse::DispatchOrderLineSerializer
      has_many :lines, serializer: Cats::Warehouse::DispatchOrderLineSerializer

      def lines
        object.dispatch_order_lines
      end

      def source_warehouse_id
        object.warehouse_id
      end

      def source_warehouse_name
        object.warehouse&.name
      end

      def expected_pickup_date
        object.dispatched_date
      end

      def fdp_name
        object.fdp&.name
      end
      has_many :dispatch_order_assignments, serializer: Cats::Warehouse::DispatchOrderAssignmentSerializer
      has_many :stock_reservations, serializer: Cats::Warehouse::StockReservationSerializer

      def status
        object.status.to_s.titleize
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
        [object.created_by&.first_name, object.created_by&.last_name].compact.join(" ").presence || object.created_by&.email
      end

      def confirmed_by_name
        [object.confirmed_by&.first_name, object.confirmed_by&.last_name].compact.join(" ").presence || object.confirmed_by&.email
      end

      def location_name
        object.location&.name
      end

      # Total quantity ordered across all lines (sum of line quantities in their own units —
      # used as a simple reference total for display; canonical comparison uses line-level units).
      def total_ordered_quantity
        object.dispatch_order_lines.sum { |l| l.quantity.to_f }
      end

      # Total quantity already covered by confirmed Dispatch Authorizations for this order.
      def total_authorized_quantity
        DispatchOrderAuthorization
          .where(dispatch_order_id: object.id, status: DispatchOrderAuthorization::CONFIRMED)
          .sum(:authorized_quantity)
          .to_f
      end

      # Remaining quantity available for new Dispatch Authorizations.
      # When <= 0 the order is fully covered and should not accept new DAs.
      def remaining_quantity
        ordered = total_ordered_quantity
        authorized = total_authorized_quantity
        [ordered - authorized, 0].max.round(4)
      end
    end
  end
end
