module Cats
  module Warehouse
    class CommodityDefinition < ApplicationRecord
      self.table_name = "cats_warehouse_commodity_definitions"

      validates :name, presence: true, uniqueness: { case_sensitive: false }
      validates :commodity_code,
                presence: true,
                uniqueness: { case_sensitive: false },
                format: { with: /\A[A-Za-z0-9\-_]+\z/, message: "only allows letters, numbers, hyphens, and underscores" },
                length: { maximum: 50 }

      before_validation :upcase_commodity_code

      def category_name
        return nil if commodity_category_id.blank?

        @category_name ||= Cats::Core::CommodityCategory.find_by(id: commodity_category_id)&.name
      end

      private

      def upcase_commodity_code
        self.commodity_code = commodity_code&.strip&.upcase
      end
    end
  end
end
