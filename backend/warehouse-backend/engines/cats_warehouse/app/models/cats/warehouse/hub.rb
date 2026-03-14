module Cats
  module Warehouse
    class Hub < ApplicationRecord
      self.table_name = "cats_warehouse_hubs"

      belongs_to :location, class_name: "Cats::Core::Location"
      belongs_to :geo, class_name: "Cats::Warehouse::Geo", optional: true

      has_one :hub_capacity, class_name: "Cats::Warehouse::HubCapacity", dependent: :destroy
      has_one :hub_access, class_name: "Cats::Warehouse::HubAccess", dependent: :destroy
      has_one :hub_infra, class_name: "Cats::Warehouse::HubInfra", dependent: :destroy
      has_one :hub_contacts, class_name: "Cats::Warehouse::HubContacts", dependent: :destroy

      has_many :warehouses, class_name: "Cats::Warehouse::Warehouse", dependent: :nullify

      validates :name, presence: true
    end
  end
end
