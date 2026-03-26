module Cats
  module Warehouse
    class Waybill < ApplicationRecord
      self.table_name = "cats_warehouse_waybills"
      include DocumentLifecycle

      belongs_to :dispatch, class_name: "Cats::Core::Dispatch", optional: true
      belongs_to :source_location, class_name: "Cats::Core::Location"
      belongs_to :destination_location, class_name: "Cats::Core::Location"

      has_one :waybill_transport, class_name: "Cats::Warehouse::WaybillTransport", dependent: :destroy
      has_many :waybill_items, class_name: "Cats::Warehouse::WaybillItem", dependent: :destroy

      validates :issued_on, presence: true
      validate :locations_must_differ

      private

      def locations_must_differ
        return if source_location_id.blank? || destination_location_id.blank?
        return if source_location_id != destination_location_id

        errors.add(:destination_location_id, "must differ from source location")
      end
    end
  end
end
