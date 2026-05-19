module Cats
  module Warehouse
    class GrnSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :warehouse_name, :warehouse_code, :received_on, :source_type, :source_id,
                 :source_reference, :status, :workflow_status, :receipt_order_id, :generated_from_inspection_id,
                 :received_by_id, :received_by_name, :approved_by_id, :approved_by_name,
                 :receipt_authorization_id, :ra_transporter_name, :ra_driver_name,
                 :ra_truck_plate_number, :ra_waybill_number, :ra_authorized_quantity,
                 :ra_authorized_quantity_input, :ra_authorized_quantity_input_unit_id,
                 :ra_authorized_quantity_input_unit_name, :ra_authorized_quantity_input_unit_abbreviation,
                 :ra_packaging_unit_name, :ra_packaging_unit_abbreviation, :ra_expected_packaging_units,
                 :inspection_lost_quantity,
                 :created_at, :updated_at
      belongs_to :receipt_order, serializer: ReceiptOrderSerializer
      has_many :grn_items, serializer: GrnItemSerializer

      def status
        object[:status].to_s.downcase
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

      def receipt_authorization_id
        object.receipt_authorization&.id
      end

      def ra_transporter_name
        object.receipt_authorization&.transporter&.name
      end

      def ra_driver_name
        object.receipt_authorization&.driver_name
      end

      def ra_truck_plate_number
        object.receipt_authorization&.truck_plate_number
      end

      def ra_waybill_number
        object.receipt_authorization&.waybill_number
      end

      def ra_authorized_quantity
        object.receipt_authorization&.authorized_quantity
      end

      def ra_authorized_quantity_input
        ra = object.receipt_authorization
        return unless ra

        ra.authorized_quantity_input.presence || ra.authorized_quantity
      end

      def ra_authorized_quantity_input_unit_id
        input_unit&.id
      end

      def ra_authorized_quantity_input_unit_name
        input_unit&.name
      end

      def ra_authorized_quantity_input_unit_abbreviation
        input_unit&.abbreviation
      end

      def ra_packaging_unit_name
        object.receipt_authorization&.receipt_order_line&.packaging_unit&.name
      end

      def ra_packaging_unit_abbreviation
        object.receipt_authorization&.receipt_order_line&.packaging_unit&.abbreviation
      end

      def ra_expected_packaging_units
        ra = object.receipt_authorization
        line = ra&.receipt_order_line
        return nil unless ra && line&.packaging_size.present? && line.packaging_unit_id.present?

        package_size = line.packaging_size.to_f
        return nil unless package_size.positive?

        basis_unit_id = packaging_size_basis_unit_id(line)
        return nil unless line.unit_id.present? && basis_unit_id.present?

        quantity_in_basis = UomConversionResolver.convert(
          ra.authorized_quantity,
          from_unit_id: line.unit_id,
          to_unit_id: basis_unit_id,
          commodity_id: line.commodity_id
        )
        return nil unless quantity_in_basis.to_f.positive?

        (quantity_in_basis.to_f / package_size).ceil
      end

      def inspection_lost_quantity
        object.generated_from_inspection&.inspection_items&.sum(:quantity_lost)&.to_f
      end

      def input_unit
        ra = object.receipt_authorization
        return unless ra

        ra.authorized_quantity_input_unit || ra.receipt_order_line&.unit
      end

      def packaging_size_basis_unit_id(line)
        commodity = line.commodity_id.present? ? Cats::Core::Commodity.find_by(id: line.commodity_id) : nil
        commodity&.package_unit_per_package_id.presence || line.unit_id
      end
    end
  end
end
