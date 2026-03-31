module Cats
  module Warehouse
    class DispatchOrderSerializer < ApplicationSerializer
      attributes :id, :reference_no, :status, :dispatched_date, :destination_type, :destination_id, :destination_reference,
                 :hub_id, :hub_name, :warehouse_id, :warehouse_name, :warehouse_code,
                 :created_by_id, :created_by_name, :confirmed_by_id, :confirmed_by_name,
                 :description, :created_at, :updated_at

      has_many :dispatch_order_lines, serializer: DispatchOrderLineSerializer

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
    end

    class DispatchOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name

      def commodity_name
        object.commodity&.name
      end

      def unit_name
        object.unit&.abbreviation
      end
    end
  end
end
