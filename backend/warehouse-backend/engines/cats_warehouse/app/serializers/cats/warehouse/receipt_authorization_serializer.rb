module Cats
  module Warehouse
    class ReceiptAuthorizationSerializer < ApplicationSerializer
      attributes :id, :reference_no, :status,
                 :receipt_order_id, :receipt_order_reference_no,
                 :receipt_order_assignment_id, :receipt_order_line_id,
                 :store_id, :store_name,
                 :warehouse_id, :warehouse_name,
                 :transporter_id, :transporter_name,
                 :authorized_quantity,
                 :authorized_quantity_input,
                 :authorized_quantity_input_unit_id,
                 :authorized_quantity_input_unit_name,
                 :authorized_quantity_input_unit_abbreviation,
                 :commodity_id, :commodity_name, :unit_id, :unit_name, :unit_label, :unit_abbreviation,
                 :packaging_unit_id, :packaging_unit_name, :packaging_unit_abbreviation,
                 :packaging_size, :expected_packaging_units, :packaging_spec_label,
                 :driver_name, :driver_id_number, :truck_plate_number, :waybill_number,
                 :driver_confirmed_at, :driver_confirmed_by_name,
                 :inspection_id, :total_received, :inspections_count,
                 :my_inspection, :my_grn,
                 :grn_id, :grn_reference_no, :grn_status,
                 :created_by_name,
                 :cancelled_at,
                 :created_at, :updated_at

      def status
        if object.active? && object.generated_inspection_grns_confirmed?
          return ReceiptAuthorization::CLOSED
        end

        object.status
      end

      def receipt_order_reference_no
        object.receipt_order&.reference_no
      end

      # The quantity exactly as typed by whoever last set it (e.g. 30 when the user picked
      # Kuntal). Falls back to the canonical `authorized_quantity` so legacy rows still
      # render a coherent value.
      def authorized_quantity_input
        col_value = object.respond_to?(:authorized_quantity_input) ? object.authorized_quantity_input : nil
        return col_value.to_f if col_value.present?

        object.authorized_quantity.to_f
      end

      # The UOM id the user picked when entering the quantity. Falls back to the receipt-order
      # line unit so older rows keep producing readable display data.
      def authorized_quantity_input_unit_id
        col_value = object.respond_to?(:authorized_quantity_input_unit_id) ? object.authorized_quantity_input_unit_id : nil
        return col_value if col_value.present?

        unit_id
      end

      def authorized_quantity_input_unit_name
        u = resolved_input_unit
        u&.name
      end

      def authorized_quantity_input_unit_abbreviation
        u = resolved_input_unit
        u&.abbreviation
      end

      def commodity_id
        object.receipt_order_line&.commodity_id ||
          object.receipt_order&.receipt_order_lines&.first&.commodity_id
      end

      def commodity_name
        cid = commodity_id
        return nil unless cid
        commodity = Cats::Core::Commodity.find_by(id: cid)
        return nil unless commodity
        commodity.read_attribute(:name).presence || commodity.batch_no
      end

      def unit_id
        object.receipt_order_line&.unit_id ||
          object.receipt_order&.receipt_order_lines&.first&.unit_id
      end

      def unit_name
        # Legacy: same as unit_abbreviation (hub line UOM short form).
        unit_abbreviation
      end

      def unit_label
        line_unit&.name
      end

      def unit_abbreviation
        line_unit&.abbreviation
      end

      def packaging_unit_id
        object.receipt_order_line&.packaging_unit_id
      end

      def packaging_unit_name
        object.receipt_order_line&.packaging_unit&.name
      end

      def packaging_unit_abbreviation
        object.receipt_order_line&.packaging_unit&.abbreviation
      end

      def packaging_size
        object.receipt_order_line&.packaging_size
      end

      # Human-readable spec for the hub line (e.g. "50 kg per BAG") using the same basis unit as
      # expected_packaging_units — not the receipt line unit unless no commodity basis exists.
      def packaging_spec_label
        line = object.receipt_order_line
        return nil unless line&.packaging_size.present? && line.packaging_unit_id

        pkg_u = line.packaging_unit
        return nil unless pkg_u

        basis_uid = packaging_size_basis_unit_id
        per_u = basis_uid ? Cats::Core::UnitOfMeasure.find_by(id: basis_uid) : nil
        per = per_u&.abbreviation.presence || per_u&.name.presence || "unit"
        container = pkg_u.abbreviation.presence || pkg_u.name.presence || "package"
        "#{format_packaging_number(line.packaging_size)} #{per} per #{container}"
      end

      # Matches frontend `computePackagingPackagesHint`: packaging_size is expressed in
      # commodity.package_unit_per_package's unit when present, else receipt line unit_id.
      # Converts authorized_quantity from the line unit into that basis before dividing.
      def expected_packaging_units
        line = object.receipt_order_line
        return nil unless line&.packaging_size.present? && line.packaging_unit_id

        ps = line.packaging_size.to_f
        return nil unless ps.positive?

        auth = object.authorized_quantity.to_f
        return nil unless auth.positive?

        line_uid = line.unit_id
        basis_uid = packaging_size_basis_unit_id
        return nil unless line_uid && basis_uid

        cid = line.commodity_id
        qty_basis = authorized_quantity_in_packaging_basis(auth, line_uid, basis_uid, cid)
        return nil unless qty_basis.present? && qty_basis.to_f.positive?

        # Same basis as line: "per package" larger than whole shipment usually means wrong unit
        # (e.g. 50 was kg per bag but was divided as 50 mt per bag).
        return nil if line_uid == basis_uid && ps > auth

        (qty_basis.to_f / ps).ceil
      end

      def store_name
        object.store&.name
      end

      def warehouse_name
        object.warehouse&.name
      end

      def transporter_name
        object.transporter&.name
      end

      def driver_confirmed_by_name
        user = object.driver_confirmed_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      def inspection_id
        # Return the most recent inspection for backward compatibility
        object.inspections.order(created_at: :desc).first&.id
      end

      def total_received
        object.inspections.joins(:inspection_items).sum("cats_warehouse_inspection_items.quantity_received").to_f
      end

      def inspections_count
        object.inspections.count
      end

      # The current user's own inspection for this RA (nil if they haven't recorded yet)
      def my_inspection
        return nil unless current_user
        insp = object.inspections.find_by(inspector_id: current_user.id)
        return nil unless insp
        {
          id: insp.id,
          total_received: insp.inspection_items.sum(:quantity_received).to_f,
          quality_status: insp.inspection_items.first&.quality_status,
          created_at: insp.created_at
        }
      end

      # The GRN generated from the current user's inspection
      def my_grn
        return nil unless current_user
        insp = object.inspections.find_by(inspector_id: current_user.id)
        return nil unless insp
        return nil unless insp.auto_generated_grn_id.present?
        grn = Grn.find_by(id: insp.auto_generated_grn_id)
        return nil unless grn
        {
          id: grn.id,
          reference_no: grn.reference_no,
          status: grn.status
        }
      end

      def grn_id
        object.grns.order(created_at: :desc).first&.id
      end

      def grn_reference_no
        object.grns.order(created_at: :desc).first&.reference_no
      end

      def grn_status
        object.grns.order(created_at: :desc).first&.status
      end

      def created_by_name
        user = object.created_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end

      private

      def line_unit
        @line_unit ||= begin
          uid = unit_id
          Cats::Core::UnitOfMeasure.find_by(id: uid) if uid
        end
      end

      def resolved_input_unit
        return @resolved_input_unit if defined?(@resolved_input_unit)

        col_value = object.respond_to?(:authorized_quantity_input_unit_id) ? object.authorized_quantity_input_unit_id : nil
        @resolved_input_unit =
          if col_value.present?
            Cats::Core::UnitOfMeasure.find_by(id: col_value)
          else
            line_unit
          end
      end

      def commodity_for_packaging
        return @commodity_for_packaging if defined?(@commodity_for_packaging)

        cid = object.receipt_order_line&.commodity_id
        @commodity_for_packaging = cid.present? ? Cats::Core::Commodity.find_by(id: cid) : nil
      end

      def packaging_size_basis_unit_id
        line = object.receipt_order_line
        return nil unless line

        commodity_for_packaging&.package_unit_per_package_id.presence || line.unit_id
      end

      def authorized_quantity_in_packaging_basis(auth, line_uid, basis_uid, commodity_id)
        return auth if line_uid == basis_uid

        converted = UomConversionResolver.convert(
          auth,
          from_unit_id: line_uid,
          to_unit_id: basis_uid,
          commodity_id: commodity_id
        )
        # No conversion path (multiplier defaulted to 1) — do not emit a misleading package count.
        return nil if (converted.to_f - auth.to_f).abs < 0.000_001

        converted
      end

      def format_packaging_number(value)
        f = value.to_f
        return f.to_i.to_s if (f - f.round).abs < 1.0e-6

        s = format("%.4f", f)
        s.sub(/\.?0+$/, "")
      end
    end
  end
end
