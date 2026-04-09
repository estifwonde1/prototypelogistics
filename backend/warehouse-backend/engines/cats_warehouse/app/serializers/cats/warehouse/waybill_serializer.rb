module Cats
  module Warehouse
    class WaybillSerializer < ApplicationSerializer
      attributes :id, :reference_no, :dispatch_id, :dispatch_order_id, :prepared_by_id, :auto_generated_gin_id,
                 :source_location_id, :destination_location_id, :source_location_name, :destination_location_name,
                 :issued_on, :status, :workflow_status, :created_at, :updated_at
      has_one :waybill_transport, serializer: WaybillTransportSerializer
      has_many :waybill_items, serializer: WaybillItemSerializer

      def status
        object[:status].to_s.titleize
      end

      def source_location_name
        Cats::Core::Location.find_by(id: object.source_location_id)&.name
      end

      def destination_location_name
        Cats::Core::Location.find_by(id: object.destination_location_id)&.name
      end
    end
  end
end
