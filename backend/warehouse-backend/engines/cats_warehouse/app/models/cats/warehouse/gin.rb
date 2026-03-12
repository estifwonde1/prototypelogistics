module Cats
  module Warehouse
    class Gin < ApplicationRecord
      self.table_name = "cats_warehouse_gins"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :destination, polymorphic: true, optional: true
      belongs_to :issued_by, class_name: "Cats::Core::User"
      belongs_to :approved_by, class_name: "Cats::Core::User", optional: true

      has_many :gin_items, class_name: "Cats::Warehouse::GinItem", dependent: :destroy
    end
  end
end
