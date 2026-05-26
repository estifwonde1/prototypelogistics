# frozen_string_literal: true

module Cats
  module Warehouse
    class TransportRecord < ApplicationRecord
      self.table_name = "cats_warehouse_transport_records"

      belongs_to :dispatch_order, class_name: "Cats::Warehouse::DispatchOrder"
      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :recorded_by, class_name: "Cats::Core::User"

      validates :driver_name, :vehicle_plate, presence: true
    end
  end
end
