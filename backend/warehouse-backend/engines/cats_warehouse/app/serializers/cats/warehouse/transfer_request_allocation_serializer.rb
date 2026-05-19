# frozen_string_literal: true

module Cats
  module Warehouse
    class TransferRequestAllocationSerializer < ApplicationSerializer
      attributes :id, :action, :quantity, :entered_quantity, :package_count, :notes, :created_at,
                 :entered_unit, :source_stack, :destination_stack, :destination_store,
                 :stack_transaction_id, :released_to_source_stack, :reviewed_by

      def quantity
        object.quantity.to_f
      end

      def entered_quantity
        object.entered_quantity&.to_f
      end

      def package_count
        object.package_count&.to_f
      end

      def stack_transaction_id
        object.stack_transaction_id
      end

      def released_to_source_stack
        object.action == "rejection"
      end

      def source_stack
        stack = transfer_request&.source_stack
        return nil unless stack.present?

        { id: stack.id, code: stack.code }
      end

      def destination_store
        store = object.destination_stack&.store || transfer_request&.destination_store
        return nil unless store.present?

        { id: store.id, name: store.name, code: store.code }
      end

      def entered_unit
        return nil unless object.entered_unit.present?

        {
          id: object.entered_unit.id,
          name: object.entered_unit.name || "",
          abbreviation: object.entered_unit.abbreviation || ""
        }
      end

      def destination_stack
        return nil unless object.destination_stack.present?

        stack = object.destination_stack
        store = stack.store

        {
          id: stack.id,
          code: stack.code,
          store_name: store&.name,
          store_id: store&.id
        }
      end

      def reviewed_by
        return nil unless object.reviewed_by.present?

        {
          id: object.reviewed_by.id,
          name: [object.reviewed_by.first_name, object.reviewed_by.last_name].compact.join(" ").presence ||
            object.reviewed_by.email,
          email: object.reviewed_by.email
        }
      end

      private

      def transfer_request
        object.transfer_request
      end
    end
  end
end
