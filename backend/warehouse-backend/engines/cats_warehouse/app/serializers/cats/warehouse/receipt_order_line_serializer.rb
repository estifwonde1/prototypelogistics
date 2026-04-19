module Cats
  module Warehouse
    class ReceiptOrderLineSerializer < ApplicationSerializer
      attributes :id, :commodity_id, :commodity_name, :quantity, :unit_id, :unit_name, :line_reference_no, :source_type, :source_name

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
        unit = Cats::Core::UnitOfMeasure.find_by(id: object.packaging_unit_id)
        unit&.abbreviation || unit&.name
      end

      def total_quantity
        return nil unless object.has_attribute?(:packaging_size)
        return nil if object.packaging_size.blank?
        (object.quantity.to_f * object.packaging_size.to_f).round(4)
      end

      def commodity_name
        # Do not call Commodity#name — cats_core implements it via project.source.commodity_name,
        # which breaks when project.source is a Donor (no commodity_name). Use DB column + fallbacks.
        commodity = Cats::Core::Commodity.find_by(id: object.commodity_id)
        return unless commodity

        commodity.read_attribute(:name).presence || commodity.batch_no.presence
      end

      def unit_name
        # Reload the unit to ensure we have the right object
        unit = Cats::Core::UnitOfMeasure.find_by(id: object.unit_id)
        unit&.abbreviation
      end

      def source_type
        Cats::Core::Commodity.find_by(id: object.commodity_id)&.source_type
      end

      def source_name
        Cats::Core::Commodity.find_by(id: object.commodity_id)&.source_name
      end
    end
  end
end
