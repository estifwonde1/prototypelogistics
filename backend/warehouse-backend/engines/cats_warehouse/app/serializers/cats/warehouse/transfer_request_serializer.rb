# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestSerializer < ApplicationSerializer
      attributes :id, :reason, :status, :reviewed_at, :review_notes, :created_at, :updated_at,
                 :warehouse_id, :source_store, :destination_store, :source_stack, :destination_stack,
                 :commodity, :unit, :entered_unit, :entered_quantity, :package_count,
                 :packaging_spec_label, :requested_by, :reviewed_by, :quantity,
                 :fulfilled_quantity, :rejected_quantity, :remaining_quantity, :reserved_quantity,
                 :allocations

      def quantity
        object.quantity.to_f
      end

      def fulfilled_quantity
        object.fulfilled_quantity.to_f
      end

      def rejected_quantity
        object.rejected_quantity.to_f
      end

      def remaining_quantity
        object.remaining_quantity.to_f
      end

      def reserved_quantity
        object.reserved_quantity.to_f
      end

      def allocations
        object.allocations.order(created_at: :asc).map do |allocation|
          TransferRequestAllocationSerializer.new(allocation).as_json
        end
      end

      def entered_quantity
        object.entered_quantity&.to_f
      end

      def package_count
        object.package_count&.to_f
      end

      def entered_unit
        return nil unless object.entered_unit.present?

        {
          id: object.entered_unit.id,
          name: object.entered_unit.name || "",
          abbreviation: object.entered_unit.abbreviation || ""
        }
      end

      def packaging_spec_label
        commodity = object.commodity
        return nil unless commodity

        size = commodity.try(:package_size)
        return nil if size.blank? || size.to_f <= 0

        container_unit = Cats::Core::UnitOfMeasure.find_by(id: commodity.package_unit_id) if commodity.package_unit_id.present?
        per_pkg_unit = Cats::Core::UnitOfMeasure.find_by(id: commodity.package_unit_per_package_id) if commodity.package_unit_per_package_id.present?
        container = container_unit&.name || container_unit&.abbreviation
        per_pkg = per_pkg_unit&.abbreviation || per_pkg_unit&.name
        return nil if container.blank?

        parts = [size.to_f]
        parts << per_pkg if per_pkg.present?
        label = parts.join(" ")
        "#{label} per #{container}"
      end

      def source_store
        return nil unless object.source_store.present?

        {
          id: object.source_store.id,
          name: object.source_store.name,
          code: object.source_store.code
        }
      end

      def destination_store
        return nil unless object.destination_store.present?

        {
          id: object.destination_store.id,
          name: object.destination_store.name,
          code: object.destination_store.code
        }
      end

      def source_stack
        return nil unless object.source_stack.present?

        stack = object.source_stack
        unit = stack.unit

        {
          id: stack.id,
          code: stack.code,
          quantity: stack.quantity.to_f,
          unit_id: stack.unit_id,
          unit_name: unit&.name,
          unit_abbreviation: unit&.abbreviation
        }
      end

      def destination_stack
        return nil unless object.destination_stack.present?

        {
          id: object.destination_stack.id,
          code: object.destination_stack.code,
          quantity: object.destination_stack.quantity.to_f
        }
      end

      def commodity
        return nil unless object.commodity.present?

        {
          id: object.commodity.id,
          name: object.commodity&.[](:name) || object.commodity&.batch_no,
          code: object.commodity&.[](:code) || object.commodity&.batch_no || ""
        }
      end

      def unit
        return nil unless object.unit.present?

        {
          id: object.unit.id,
          name: object.unit&.name || "",
          abbreviation: object.unit&.abbreviation || ""
        }
      end

      def requested_by
        return nil unless object.requested_by.present?

        {
          id: object.requested_by.id,
          name: [object.requested_by.first_name, object.requested_by.last_name].compact.join(" ").presence || object.requested_by.email,
          email: object.requested_by.email
        }
      end

      def reviewed_by
        return nil unless object.reviewed_by.present?

        {
          id: object.reviewed_by.id,
          name: [object.reviewed_by.first_name, object.reviewed_by.last_name].compact.join(" ").presence || object.reviewed_by.email,
          email: object.reviewed_by.email
        }
      end
    end
  end
end
