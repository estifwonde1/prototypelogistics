module Cats
  module Warehouse
    class Warehouse < ApplicationRecord
      self.table_name = "cats_warehouse_warehouses"

      belongs_to :location, class_name: "Cats::Core::Location"
      belongs_to :hub, class_name: "Cats::Warehouse::Hub", optional: true
      belongs_to :geo, class_name: "Cats::Warehouse::Geo", optional: true

      has_one :warehouse_capacity, class_name: "Cats::Warehouse::WarehouseCapacity", dependent: :destroy
      has_one :warehouse_access, class_name: "Cats::Warehouse::WarehouseAccess", dependent: :destroy
      has_one :warehouse_infra, class_name: "Cats::Warehouse::WarehouseInfra", dependent: :destroy
      has_one :warehouse_contacts, class_name: "Cats::Warehouse::WarehouseContacts", dependent: :destroy

      has_many :stores, class_name: "Cats::Warehouse::Store", dependent: :destroy
      has_many :stacking_rules, class_name: "Cats::Warehouse::StackingRule", dependent: :destroy
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy
      has_many :grns, class_name: "Cats::Warehouse::Grn", dependent: :destroy
      has_many :gins, class_name: "Cats::Warehouse::Gin", dependent: :destroy
      has_many :inspections, class_name: "Cats::Warehouse::Inspection", dependent: :destroy
    end
  end
end
