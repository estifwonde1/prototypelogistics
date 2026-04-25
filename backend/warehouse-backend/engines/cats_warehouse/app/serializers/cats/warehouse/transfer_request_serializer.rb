# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestSerializer < ApplicationSerializer
      attributes :id, :reason, :status, :reviewed_at, :review_notes, :created_at, :updated_at,
                 :warehouse_id, :source_store, :destination_store, :source_stack, :destination_stack,
                 :commodity, :unit, :requested_by, :reviewed_by, :quantity

      def quantity
        object.quantity.to_f
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

        {
          id: object.source_stack.id,
          code: object.source_stack.code,
          quantity: object.source_stack.quantity.to_f
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
