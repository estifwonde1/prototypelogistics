module Cats
  module Warehouse
    class WaybillTransportSerializer < ApplicationSerializer
      attributes :id, :waybill_id, :transporter_id, :vehicle_plate_no, :driver_name, :driver_phone, :created_at, :updated_at
    end
  end
end
