module Cats
  module Warehouse
    class InventoryLot < ApplicationRecord
      self.table_name = "cats_warehouse_inventory_lots"

      belongs_to :commodity, class_name: "Cats::Core::Commodity"

      validates :batch_no, presence: true
      validates :batch_no, uniqueness: { scope: :commodity_id, message: "already exists for this commodity" }

      def display_name
        expiry_info = expiry_date ? " (Exp: #{expiry_date})" : ""
        "Lot: #{batch_no}#{expiry_info}"
      end
    end
  end
end
