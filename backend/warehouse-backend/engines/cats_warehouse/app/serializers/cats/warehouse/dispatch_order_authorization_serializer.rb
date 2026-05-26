# frozen_string_literal: true

module Cats
  module Warehouse
    class DispatchOrderAuthorizationSerializer < ApplicationSerializer
      attributes :id, :dispatch_order_id, :warehouse_id, :reference_no, :status, :status_label,
                 :authorized_quantity, :authorized_base_quantity, :remaining_quantity,
                 :driver_name, :driver_id_number, :truck_plate_number, :transporter_id, :transporter_name,
                 :created_by_id, :confirmed_at, :driver_confirmed_at

      belongs_to :warehouse, serializer: LookupOptionSerializer
      has_many :dispatch_order_authorization_stores, serializer: DispatchOrderAuthorizationStoreSerializer

      def status_label
        object.status.to_s.titleize
      end
    end
  end
end
