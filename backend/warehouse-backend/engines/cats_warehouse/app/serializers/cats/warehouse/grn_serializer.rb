module Cats
  module Warehouse
    class GrnSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :warehouse_name, :warehouse_code, :received_on, :source_type, :source_id,
                 :source_reference, :status, :workflow_status, :receipt_order_id, :generated_from_inspection_id,
                 :received_by_id, :received_by_name, :approved_by_id, :approved_by_name, :created_at, :updated_at
      has_many :grn_items, serializer: GrnItemSerializer

      def status
        object[:status].to_s.titleize
      end

      def source_type
        case object[:source_type].to_s.demodulize
        when "Grn"
          "GRN"
        else
          object[:source_type].to_s.demodulize.presence
        end
      end

      def source_reference
        return unless object.source.present?
        return object.source.reference_no if object.source.respond_to?(:reference_no)

        object.source.id
      end

      def warehouse_name
        object.warehouse&.name
      end

      def warehouse_code
        object.warehouse&.code
      end

      def received_by_name
        object.warehouse&.warehouse_contacts&.manager_name.presence ||
          [ object.received_by&.first_name, object.received_by&.last_name ].compact.join(" ").presence ||
          object.received_by&.email
      end

      def approved_by_name
        [ object.approved_by&.first_name, object.approved_by&.last_name ].compact.join(" ").presence ||
          object.approved_by&.email
      end
    end
  end
end
