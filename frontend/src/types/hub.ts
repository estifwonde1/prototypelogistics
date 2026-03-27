export interface Hub {
  id: number;
  code: string;
  name: string;
  hub_type: string;
  status: string;
  description?: string;
  location_id?: number;
  location_name?: string;
  subcity_name?: string;
  woreda_name?: string;
  geo_id?: number;
  geo?: HubGeo;
  capacity?: HubCapacity;
  access?: HubAccess;
  infra?: HubInfra;
  contacts?: HubContacts;
}

export interface HubGeo {
  id: number;
  latitude?: number;
  longitude?: number;
  altitude_m?: number;
  address?: string;
}

export interface HubCapacity {
  id: number;
  hub_id: number;
  total_area_sqm?: number;
  total_capacity_mt?: number;
  construction_year?: number;
  ownership_type?: string;
}

export interface HubAccess {
  id: number;
  hub_id: number;
  has_loading_dock?: boolean;
  number_of_loading_docks?: number;
  loading_dock_type?: string;
  access_road_type?: string;
  nearest_town?: string;
  distance_from_town_km?: number;
  has_weighbridge?: boolean;
}

export interface HubInfra {
  id: number;
  hub_id: number;
  floor_type?: string;
  roof_type?: string;
  has_ventilation?: boolean;
  has_drainage_system?: boolean;
  has_fumigation_facility?: boolean;
  has_pest_control?: boolean;
  has_fire_extinguisher?: boolean;
  has_security_guard?: boolean;
  security_type?: string;
}

export interface HubContacts {
  id: number;
  hub_id: number;
  manager_name?: string;
  contact_phone?: string;
  contact_email?: string;
}
