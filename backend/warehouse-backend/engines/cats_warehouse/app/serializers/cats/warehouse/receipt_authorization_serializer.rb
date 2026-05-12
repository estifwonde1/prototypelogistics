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
                 :driver_name, :driver_id_number, :truck_plate_number, :waybill_number,
                 :driver_confirmed_at, :driver_confirmed_by_name,
                 :inspection_id, :total_received, :inspections_count,
                 :my_inspection, :my_grn,
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
        grn = insp.auto_generated_grn
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
    end
  end
end
