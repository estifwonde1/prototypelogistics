export interface Warehouse {
  id: number;
  code: string;
  name: string;
  warehouse_type: string;
  status: string;
  description?: string;
  location_id?: number;
  hub_id?: number;
  geo_id?: number;
  ownership_type?: string;
  capacity?: WarehouseCapacity;
  access?: WarehouseAccess;
  infra?: WarehouseInfra;
  contacts?: WarehouseContacts;
}

export interface WarehouseCapacity {
  id: number;
  warehouse_id: number;
  total_area_sqm?: number;
  total_storage_capacity_mt?: number;
  usable_storage_capacity_mt?: number;
  no_of_stores?: number;
  construction_year?: number;
  ownership_type?: string;
}

export interface WarehouseAccess {
  id: number;
  warehouse_id: number;
  has_loading_dock?: boolean;
  number_of_loading_docks?: number;
  access_road_type?: string;
  nearest_town?: string;
  distance_from_town_km?: number;
}

export interface WarehouseInfra {
  id: number;
  warehouse_id: number;
  floor_type?: string;
  roof_type?: string;
  has_fumigation_facility?: boolean;
  has_fire_extinguisher?: boolean;
  has_security_guard?: boolean;
}

export interface WarehouseContacts {
  id: number;
  warehouse_id: number;
  manager_name?: string;
  contact_phone?: string;
  contact_email?: string;
}
