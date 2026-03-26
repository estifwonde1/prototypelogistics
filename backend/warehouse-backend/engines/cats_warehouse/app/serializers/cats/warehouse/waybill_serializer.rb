module Cats
  module Warehouse
    class WaybillSerializer < ApplicationSerializer
      attributes :id, :reference_no, :dispatch_id, :source_location_id, :destination_location_id,
                 :issued_on, :status, :created_at, :updated_at
      has_one :waybill_transport, serializer: WaybillTransportSerializer
      has_many :waybill_items, serializer: WaybillItemSerializer

      def status
        object[:status].to_s.titleize
      end
    end
  end
end
