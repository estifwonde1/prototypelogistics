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
                 :created_by_name,
                 :cancelled_at,
                 :created_at, :updated_at

      def receipt_order_reference_no
        object.receipt_order&.reference_no
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
