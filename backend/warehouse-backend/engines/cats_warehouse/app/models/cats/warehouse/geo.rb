module Cats
  module Warehouse
    class Geo < ApplicationRecord
      self.table_name = "cats_warehouse_geos"

      has_one :hub, class_name: "Cats::Warehouse::Hub", dependent: :nullify
      has_one :warehouse, class_name: "Cats::Warehouse::Warehouse", dependent: :nullify
    end
  end
end
