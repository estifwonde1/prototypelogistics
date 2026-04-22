module Cats
  module Warehouse
    class CommodityDefinition < ApplicationRecord
      self.table_name = "cats_warehouse_commodity_definitions"

      validates :name, presence: true, uniqueness: { case_sensitive: false }

      def category_name
        return nil if commodity_category_id.blank?

        @category_name ||= Cats::Core::CommodityCategory.find_by(id: commodity_category_id)&.name
      end
    end
  end
end
