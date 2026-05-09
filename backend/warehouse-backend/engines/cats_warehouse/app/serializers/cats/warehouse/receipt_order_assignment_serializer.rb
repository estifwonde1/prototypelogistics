module Cats
  module Warehouse
    class ReceiptOrderAssignmentSerializer < ApplicationSerializer
      attributes :id, :receipt_order_id, :receipt_order_line_id, :hub_id, :hub_name, :warehouse_id, :warehouse_name,
                 :hub_warehouses_count, :store_id, :store_name, :assigned_by_id, :assigned_by_name, :assigned_to_id,
                 :assigned_to_name, :quantity, :quantity_unit_id, :quantity_unit_abbreviation, :status, :assigned_at,
                 :created_at, :updated_at

      def hub_name
        object.hub&.name
      end

      def warehouse_name
        object.warehouse&.name
      end

      def hub_warehouses_count
        return nil if object.hub_id.blank?

        Warehouse.where(hub_id: object.hub_id).count
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

      # Unit for displayed quantity: explicit line, else first line on the order (hub-level assignments).
      def quantity_unit_id
        measurement_line&.unit_id
      end

      def quantity_unit_abbreviation
        line = measurement_line
        return if line.blank?

        u = line.try(:unit) || Cats::Core::UnitOfMeasure.find_by(id: line.unit_id)
        u&.abbreviation.presence || u&.name
      end

      private

      def measurement_line
        if object.receipt_order_line.present?
          object.receipt_order_line
        else
          ro = object.receipt_order
          return unless ro

          rel = ro.receipt_order_lines
          rel.loaded? ? rel.min_by(&:id) : rel.order(:id).first
        end
      end

      def user_display_name(user)
        return if user.blank?

        [ user.first_name, user.last_name ].compact.join(" ").strip.presence || user.email
      end
    end
  end
end
