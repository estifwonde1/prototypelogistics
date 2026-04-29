module Cats
  module Warehouse
    class ReceiptOrderSerializer < ApplicationSerializer
      attributes :id, :reference_no, :name, :status, :received_date, :source_type, :source_id, :source_reference,
                 :source_name,
                 :hub_id, :hub_name, :warehouse_id, :warehouse_name, :warehouse_code,
                 :created_by_id, :created_by_name, :confirmed_by_id, :confirmed_by_name, :confirmed_at,
                 :description, :created_at, :updated_at,
                 :location_id, :hierarchical_level, :location_name

      has_many :receipt_order_lines, serializer: Cats::Warehouse::ReceiptOrderLineSerializer
      has_many :receipt_order_assignments, serializer: Cats::Warehouse::ReceiptOrderAssignmentSerializer
      has_many :space_reservations, serializer: Cats::Warehouse::SpaceReservationSerializer

      def status
        object.status.to_s.titleize
      end

      def source_reference
        return unless object.source.present?

        object.source.respond_to?(:reference_no) ? object.source.reference_no : object.source.id
      end

      def source_name
        # Try order-level source association first
        src = object.source
        if src.present?
          label = src.respond_to?(:name) ? src.name.presence : nil
          label ||= src.respond_to?(:reference_no) ? src.reference_no.presence : nil
          label ||= src.id.to_s
          type = object.source_type.to_s.presence
          return type ? "#{type} — #{label}" : label
        end

        # Fall back to order name field
        return object.name if object.name.present?

        # Fall back to first line's commodity source
        first_line = object.receipt_order_lines.first
        return nil unless first_line

        commodity = Cats::Core::Commodity.find_by(id: first_line.commodity_id)
        return nil unless commodity

        type = commodity.source_type.to_s.presence
        name = commodity.source_name.to_s.presence
        return nil unless type || name

        type && name ? "#{type} — #{name}" : (type || name)
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
    end
  end
end
