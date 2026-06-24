module Cats
  module Warehouse
    class GinSerializer < ApplicationSerializer
      attributes :id, :reference_no, :warehouse_id, :issued_on, :destination_type, :destination_id,
                 :status, :workflow_status, :dispatch_order_id, :generated_from_waybill_id,
                 :issued_by_id, :approved_by_id, :created_at, :updated_at, :transporter_id,
                 :truck_plate_number, :driver_name, :driver_id_number, :driver_confirmed_at,
                 :driver_confirmed_by_id, :driver_confirmed_by_name
      has_many :gin_items, serializer: GinItemSerializer

      def status
        object[:status].to_s.titleize
      end

      def driver_confirmed_by_name
        user = object.driver_confirmed_by
        return nil unless user

        [ user.first_name, user.last_name ].compact.join(" ").presence || user.email
      end
    end
  end
end
