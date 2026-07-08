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
      validates :volume_per_metric_ton,
                numericality: { greater_than: 0 },
                allow_nil: true

      before_validation :upcase_commodity_code
      before_validation :apply_default_volume_per_metric_ton

      def category_name
        return nil if commodity_category_id.blank?

        @category_name ||= Cats::Core::CommodityCategory.find_by(id: commodity_category_id)&.name
      end

      private

      def upcase_commodity_code
        self.commodity_code = commodity_code&.strip&.upcase
      end

      def apply_default_volume_per_metric_ton
        return if volume_per_metric_ton.to_f.positive?

        self.volume_per_metric_ton = CommodityDensityResolver.default_density
      end
    end
  end
end
