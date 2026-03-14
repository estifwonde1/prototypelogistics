module Cats
  module Warehouse
    class Waybill < ApplicationRecord
      self.table_name = "cats_warehouse_waybills"

      belongs_to :dispatch, class_name: "Cats::Core::Dispatch", optional: true
      belongs_to :source_location, class_name: "Cats::Core::Location"
      belongs_to :destination_location, class_name: "Cats::Core::Location"

      has_one :waybill_transport, class_name: "Cats::Warehouse::WaybillTransport", dependent: :destroy
      has_many :waybill_items, class_name: "Cats::Warehouse::WaybillItem", dependent: :destroy

      validates :issued_on, presence: true
    end
  end
end
