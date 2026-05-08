module Cats
  module Warehouse
    class ReceiptAuthorizationSerializer < ApplicationSerializer
      attributes :id, :reference_no, :status,
                 :receipt_order_id, :receipt_order_reference_no,
                 :receipt_order_assignment_id,
                 :store_id, :store_name,
                 :warehouse_id, :warehouse_name,
                 :transporter_id, :transporter_name,
                 :authorized_quantity,
                 :driver_name, :driver_id_number, :truck_plate_number, :waybill_number,
                 :driver_confirmed_at, :driver_confirmed_by_name,
                 :inspection_id,
                 :grn_id, :grn_reference_no, :grn_status,
                 :commodity_id, :commodity_name, :unit_id, :unit_name,
                 :created_by_name,
                 :cancelled_at,
                 :created_at, :updated_at

      def receipt_order_reference_no
        object.receipt_order&.reference_no
      end

      def commodity_id
        object.receipt_order&.receipt_order_lines&.first&.commodity_id
      end

      def commodity_name
        commodity_id_val = object.receipt_order&.receipt_order_lines&.first&.commodity_id
        return nil unless commodity_id_val
        commodity = Cats::Core::Commodity.find_by(id: commodity_id_val)
        return nil unless commodity
        commodity.read_attribute(:name).presence || commodity.batch_no.presence
      end

      def unit_id
        object.receipt_order&.receipt_order_lines&.first&.unit_id
      end

      def unit_name
        object.receipt_order&.receipt_order_lines&.first&.unit&.name
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
        object.inspection&.id
      end

      def grn_id
        object.grn&.id
      end

      def grn_reference_no
        object.grn&.reference_no
      end

      def grn_status
        object.grn&.status
      end

      def created_by_name
        user = object.created_by
        return nil unless user

        [user.first_name, user.last_name].compact.join(" ").presence || user.email
      end
    end
  end
end
