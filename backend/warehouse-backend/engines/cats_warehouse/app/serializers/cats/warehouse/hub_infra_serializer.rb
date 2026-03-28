module Cats
  module Warehouse
    class HubInfraSerializer < ApplicationSerializer
      attributes :id, :hub_id, :floor_type, :roof_type, :has_ventilation, :has_drainage_system,
                 :has_fumigation_facility, :has_pest_control, :has_fire_extinguisher,
                 :has_security_guard, :security_type, :created_at, :updated_at
    end
  end
end
