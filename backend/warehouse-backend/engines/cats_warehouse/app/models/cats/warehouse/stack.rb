module Cats
  module Warehouse
    class Stack < ApplicationRecord
      self.table_name = "cats_warehouse_stacks"

      belongs_to :store, class_name: "Cats::Warehouse::Store"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :unit, class_name: "Cats::Core::UnitOfMeasure"

      has_many :outgoing_stack_transactions,
               class_name: "Cats::Warehouse::StackTransaction",
               foreign_key: :source_id,
               dependent: :nullify
      has_many :incoming_stack_transactions,
               class_name: "Cats::Warehouse::StackTransaction",
               foreign_key: :destination_id,
               dependent: :nullify
      has_many :stock_balances, class_name: "Cats::Warehouse::StockBalance", dependent: :destroy
    end
  end
end
