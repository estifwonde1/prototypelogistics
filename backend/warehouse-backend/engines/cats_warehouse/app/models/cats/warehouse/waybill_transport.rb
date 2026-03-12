module Cats
  module Warehouse
    class WaybillTransport < ApplicationRecord
      self.table_name = "cats_warehouse_waybill_transport"

      belongs_to :waybill, class_name: "Cats::Warehouse::Waybill"
      belongs_to :transporter, class_name: "Cats::Core::Transporter"
    end
  end
end
