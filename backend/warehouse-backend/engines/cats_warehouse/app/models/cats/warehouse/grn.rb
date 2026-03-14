module Cats
  module Warehouse
    class Grn < ApplicationRecord
      self.table_name = "cats_warehouse_grns"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :source, polymorphic: true, optional: true
      belongs_to :received_by, class_name: "Cats::Core::User"
      belongs_to :approved_by, class_name: "Cats::Core::User", optional: true

      has_many :grn_items, class_name: "Cats::Warehouse::GrnItem", dependent: :destroy

      validates :received_on, presence: true
    end
  end
end
