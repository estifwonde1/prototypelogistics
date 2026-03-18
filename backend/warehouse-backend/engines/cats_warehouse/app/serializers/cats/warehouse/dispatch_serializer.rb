module Cats
  module Warehouse
    class DispatchSerializer < ApplicationSerializer
      attributes :id,
                 :reference_no,
                 :dispatch_plan_item_id,
                 :transporter_id,
                 :plate_no,
                 :driver_name,
                 :driver_phone,
                 :quantity,
                 :unit_id,
                 :commodity_status,
                 :remark,
                 :prepared_by_id,
                 :dispatch_status,
                 :created_at,
                 :updated_at
    end
  end
end
