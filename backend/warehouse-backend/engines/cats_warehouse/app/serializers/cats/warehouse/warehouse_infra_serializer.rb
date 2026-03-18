module Cats
  module Warehouse
    class WarehouseInfraSerializer < ApplicationSerializer
      attributes :id, :warehouse_id, :floor_type, :roof_type, :has_fumigation_facility,
                 :has_fire_extinguisher, :has_security_guard, :created_at, :updated_at
    end
  end
end
