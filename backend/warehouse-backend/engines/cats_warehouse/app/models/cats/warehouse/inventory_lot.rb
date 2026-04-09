module Cats
  module Warehouse
    class InventoryLot < ApplicationRecord
      self.table_name = "cats_warehouse_inventory_lots"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"
      belongs_to :commodity, class_name: "Cats::Core::Commodity"
      belongs_to :source, polymorphic: true, optional: true

      validates :batch_no, presence: true
      validates :batch_no, uniqueness: {
        scope: [ :warehouse_id, :commodity_id ],
        message: "already exists for this commodity in the warehouse"
      }

      def display_name
        expiry_info = expiry_date ? " (Exp: #{expiry_date})" : ""
        warehouse_info = warehouse&.code.presence || warehouse&.name.presence
        prefix = warehouse_info.present? ? "#{warehouse_info} - " : ""

        "#{prefix}Lot: #{batch_no}#{expiry_info}"
      end
    end
  end
end
