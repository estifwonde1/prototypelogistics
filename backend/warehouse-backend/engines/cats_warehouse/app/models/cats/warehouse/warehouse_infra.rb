module Cats
  module Warehouse
    class WarehouseInfra < ApplicationRecord
      self.table_name = "cats_warehouse_warehouse_infra"

      belongs_to :warehouse, class_name: "Cats::Warehouse::Warehouse"

      validates :floor_type,
                presence: true,
                inclusion: { in: FacilityReferenceData.options_for(:floor_type).map { |option| option[:value] } }
      validates :roof_type,
                presence: true,
                inclusion: { in: FacilityReferenceData.options_for(:roof_type).map { |option| option[:value] } }
    end
  end
end
