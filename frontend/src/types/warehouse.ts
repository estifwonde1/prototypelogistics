export interface Warehouse {
  id: number;
  code: string;
  name: string;
  warehouse_type: string;
  status: string;
  description?: string;
  location_id?: number;
  location_name?: string;
  subcity_name?: string;
  woreda_name?: string;
  kebele_name?: string;
  kebele?: number;
  hub_id?: number;
  hub_name?: string;
  geo_id?: number;
  geo?: WarehouseGeo;
  managed_under?: string;
  ownership_type?: string;
  capacity?: WarehouseCapacity;
  access?: WarehouseAccess;
  infra?: WarehouseInfra;
  contacts?: WarehouseContacts;
  rental_agreement_document?: UploadedDocument | null;
}

export interface UploadedDocument {
  id: number;
  filename: string;
  content_type?: string;
  byte_size?: number;
  signed_id?: string;
}

export interface WarehouseUpsertPayload {
  code?: string;
  name?: string;
  warehouse_type?: string;
  status?: string;
  description?: string;
  location_id?: number;
  hub_id?: number;
  geo_id?: number;
  managed_under?: string;
  ownership_type?: string;
  rental_agreement_document?: File | null;
  rental_agreement_document_signed_id?: string;
  kebele?: number;
}

export interface WarehouseGeo {
  id: number;
  latitude?: number;
  longitude?: number;
  altitude_m?: number;
  address?: string;
}

export interface WarehouseCapacity {
  id: number;
  warehouse_id: number;
  total_area_sqm?: number;
  total_storage_capacity_mt?: number;
  usable_storage_capacity_mt?: number;
  no_of_stores?: number;
  construction_year?: number;
}

export interface WarehouseAccess {
  id: number;
  warehouse_id: number;
  has_loading_dock?: boolean;
  number_of_loading_docks?: number;
  loading_dock_type?: string;
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
