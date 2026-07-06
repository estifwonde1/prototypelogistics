module Cats
  module Warehouse
    class Fdp < ApplicationRecord
      self.table_name = "cats_warehouse_fdps"

      belongs_to :location, class_name: "Cats::Core::Location", optional: true
      has_many :dispatch_orders, class_name: "Cats::Warehouse::DispatchOrder", dependent: :restrict_with_error

      validates :name, presence: true
      validates :location_id, presence: true
      validates :number_of_families, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
      validates :number_of_beneficiaries, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
    end
  end
end
