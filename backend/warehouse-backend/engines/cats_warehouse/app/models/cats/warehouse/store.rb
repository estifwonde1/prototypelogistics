module Cats
  module Warehouse
    class Store < ApplicationRecord
      self.table_name = "cats_warehouse_stores"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      has_many :stacks, class_name: "Cats::Warehouse::Stack", dependent: :destroy
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy

      validates :name, :length, :width, :height, :usable_space, :available_space, presence: true
    end
  end
end
