module Cats
  module Warehouse
    class ReceiptOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :commodity_batch_no, :quantity, :unit_id, :unit_name, :line_reference_no, :source_type, :source_name, :destination_hub_id, :destination_warehouse_id, :destination_hub_name, :destination_warehouse_name

      attribute :notes, if: :line_has_notes?
      attribute :packaging_unit_id, if: :line_has_packaging?
      attribute :packaging_unit_name, if: :line_has_packaging?
      attribute :packaging_size, if: :line_has_packaging?
      attribute :total_quantity, if: :line_has_packaging?

      def line_has_notes?
        object.has_attribute?(:notes)
      end

      def line_has_packaging?
        object.has_attribute?(:packaging_unit_id)
      end

      def packaging_unit_name
        return nil unless object.has_attribute?(:packaging_unit_id)
        # Use association when pre-loaded; fall back to lookup only when packaging_unit_id is set
        unit = object.try(:packaging_unit) ||
               (object.packaging_unit_id.present? ? Cats::Core::UnitOfMeasure.find_by(id: object.packaging_unit_id) : nil)
        unit&.abbreviation || unit&.name
      end

      def total_quantity
        return nil unless object.has_attribute?(:packaging_size)
        return nil if object.packaging_size.blank?
        (object.quantity.to_f * object.packaging_size.to_f).round(4)
      end

      def commodity_name
        c = object.commodity
        return unless c
        c.read_attribute(:name).presence || c.batch_no.presence
      end

      def commodity_batch_no
        object.commodity&.batch_no
      end

      def unit_name
        object.unit&.abbreviation
      end

      def source_type
        object.commodity&.source_type
      end

      def source_name
        object.commodity&.source_name
      end

      def destination_hub_name
        return nil unless object.respond_to?(:destination_hub_id) && object.destination_hub_id.present?
        object.destination_hub&.name
      end

      def destination_warehouse_name
        return nil unless object.respond_to?(:destination_warehouse_id) && object.destination_warehouse_id.present?
        object.destination_warehouse&.name
      end
    end
  end
end
